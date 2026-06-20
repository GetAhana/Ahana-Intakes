const { buildStrictPrefill, validateNimExtraction, mergePrefill } = require('./lib/strict-prefill');
const { extractIntakeFields } = require('./lib/nim-intake');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

const PLACE_FIELDS = [
  'place_id',
  'name',
  'formatted_address',
  'address_components',
  'formatted_phone_number',
  'international_phone_number',
  'website',
  'rating',
  'user_ratings_total',
  'opening_hours',
  'url',
  'types',
  'reviews',
].join(',');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ found: false, message: 'Lead lookup not configured.' }),
    };
  }

  let businessName = '';
  let leadId = '';
  try {
    const body = JSON.parse(event.body || '{}');
    businessName = String(body.businessName || '').trim();
    leadId = String(body.leadId || '').trim();
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!leadId && !businessName) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'businessName or leadId required.' }) };
  }

  try {
    const lead = leadId ? await fetchLeadById(leadId) : await fetchLeadByName(businessName);
    if (!lead) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };
    }

    if (!leadId && businessName && !namesAlign(lead.business_name, businessName)) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };
    }

    const cached = readCache(lead);
    if (cached) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          found: true,
          leadId: lead.id,
          prefill: cached.prefill,
          cached: true,
        }),
      };
    }

    const place = await fetchPlaceDetails(lead);
    const strict = buildStrictPrefill(lead, place);
    let prefill = strict.prefill;

    const nimSource = buildNimSourceBundle(lead, place);
    const hasNimCorpus = Boolean(
      nimSource.scrape.query || nimSource.scrape.description || nimSource.scrape.about || nimSource.scrape.located_in
    );

    if (hasNimCorpus && process.env.NVIDIA_API_KEY) {
      const nimRaw = await extractIntakeFields(nimSource);
      if (nimRaw) {
        const validated = validateNimExtraction(nimRaw, strict.corpus);
        prefill = mergePrefill(prefill, validated);
      }
    }

    const cachePayload = {
      prefill: prefill,
      generated_at: new Date().toISOString(),
      lead_updated_at: lead.updated_at || null,
    };
    await saveCache(lead.id, cachePayload).catch(function (err) {
      console.error('intake_prefill_cache save failed', err.message);
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        found: true,
        leadId: lead.id,
        prefill: prefill,
        cached: false,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Lookup failed: ' + err.message }),
    };
  }
};

function buildNimSourceBundle(lead, place) {
  const meta = lead.scrape_metadata && typeof lead.scrape_metadata === 'object' ? lead.scrape_metadata : {};
  return {
    business_name: lead.business_name,
    city: lead.city,
    state: lead.state,
    trade: lead.trade,
    scrape: {
      query: meta.query || '',
      description: meta.description || '',
      about: meta.about || '',
      located_in: meta.located_in || '',
      subtypes: meta.subtypes || '',
      type: meta.type || '',
    },
    google: place ? {
      name: place.name || '',
      formatted_address: place.formatted_address || '',
    } : null,
  };
}

function readCache(lead) {
  const cache = lead.intake_prefill_cache;
  if (!cache || !cache.prefill || !cache.generated_at) return null;
  if (lead.updated_at && cache.lead_updated_at && cache.lead_updated_at !== lead.updated_at) return null;
  return cache;
}

async function supabaseRequest(method, path, body) {
  const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + SUPABASE_KEY,
    Accept: 'application/json',
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers.Prefer = 'return=minimal';
  }
  const res = await fetch(url, {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Supabase ' + method + ' ' + res.status + ': ' + text.slice(0, 200));
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function supabaseGet(path) {
  return supabaseRequest('GET', path);
}

async function saveCache(leadId, cachePayload) {
  await supabaseRequest('PATCH', 'leads?id=eq.' + encodeURIComponent(leadId), {
    intake_prefill_cache: cachePayload,
  });
}

async function fetchLeadById(id) {
  const rows = await supabaseGet(
    'leads?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1'
  );
  return rows && rows[0] ? rows[0] : null;
}

async function fetchLeadByName(name) {
  const escaped = name.replace(/[%_,()]/g, ' ').trim();
  if (!escaped) return null;

  const rows = await supabaseGet(
    'leads?business_name=ilike.' + encodeURIComponent('%' + escaped + '%') +
    '&select=*&order=updated_at.desc&limit=8'
  );
  if (!rows || !rows.length) return null;

  let best = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = nameScore(row.business_name, name);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= 0.72 ? best : null;
}

async function fetchPlaceDetails(lead) {
  if (!GOOGLE_KEY) return null;
  const meta = lead.scrape_metadata && typeof lead.scrape_metadata === 'object' ? lead.scrape_metadata : {};
  const placeId = lead.google_place_id || meta.google_place_id || meta.place_id;
  if (!placeId || !/^ChI[a-zA-Z0-9_-]{10,}$/.test(String(placeId))) return null;

  const url =
    'https://maps.googleapis.com/maps/api/place/details/json' +
    '?place_id=' + encodeURIComponent(placeId) +
    '&fields=' + PLACE_FIELDS +
    '&reviews_sort=newest&key=' + GOOGLE_KEY;

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 12000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    if (data.status !== 'OK' || !data.result) return null;
    return data.result;
  } catch (err) {
    console.error('Places details failed', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function namesAlign(stored, entered) {
  return nameScore(stored, entered) >= 0.72;
}

function nameScore(stored, entered) {
  const a = normalizeName(stored);
  const b = normalizeName(entered);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  return 0;
}
