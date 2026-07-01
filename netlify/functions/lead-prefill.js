const { buildStrictPrefill, validateNimExtraction, mergePrefill } = require('./lib/strict-prefill');
const { extractIntakeFields } = require('./lib/nim-intake');
const {
  fetchLeadById,
  fetchLeadByName,
  namesAlign,
  supabaseRequest,
} = require('./lib/lead-lookup');

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

    if (hasNimCorpus && process.env.NVIDIA_API_KEY && process.env.NVIDIA_MODEL) {
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

async function saveCache(leadId, cachePayload) {
  await supabaseRequest('PATCH', 'leads?id=eq.' + encodeURIComponent(leadId), {
    intake_prefill_cache: cachePayload,
  });
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

