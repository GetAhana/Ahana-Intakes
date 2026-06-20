const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TRADE_MAP = [
  { re: /roof/i, value: 'Roofing' },
  { re: /general|remodel|contract/i, value: 'General Contracting / Remodeling' },
  { re: /hvac|heating|cooling|air condition/i, value: 'HVAC / Heating & Cooling' },
  { re: /plumb/i, value: 'Plumbing' },
  { re: /electric/i, value: 'Electrical' },
  { re: /landscap|lawn/i, value: 'Landscaping / Lawn Care' },
];

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

    const prefill = mapLeadToPrefill(lead);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        found: true,
        leadId: lead.id,
        prefill,
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

async function supabaseGet(path) {
  const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Supabase error ' + res.status + ': ' + text.slice(0, 200));
  }
  return res.json();
}

async function fetchLeadById(id) {
  const safe = encodeURIComponent(id);
  const rows = await supabaseGet(
    'leads?id=eq.' + safe + '&select=*&limit=1'
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

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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

function mapTrade(trade, meta) {
  const raw = [trade, meta && meta.type, meta && meta.subtypes].filter(Boolean).join(' ');
  for (const row of TRADE_MAP) {
    if (row.re.test(raw)) return row.value;
  }
  return '';
}

function nearestRatingOption(rating) {
  if (!rating || rating <= 0) return 'No reviews yet';
  const opts = [5.0, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.1, 4.0, 3.9, 3.8, 3.7, 3.6, 3.5, 3.4, 3.3, 3.2, 3.1, 3.0];
  let best = opts[0];
  let diff = Math.abs(rating - best);
  for (let i = 1; i < opts.length; i++) {
    const d = Math.abs(rating - opts[i]);
    if (d < diff) {
      diff = d;
      best = opts[i];
    }
  }
  return best.toFixed(1);
}

function formatWorkingHours(hours) {
  if (!hours) return '';
  if (typeof hours === 'string') return hours.trim();
  if (Array.isArray(hours)) return hours.filter(Boolean).join(' · ');
  if (typeof hours === 'object') {
    return Object.keys(hours)
      .map(function (day) {
        return day + ': ' + hours[day];
      })
      .join(' · ');
  }
  return '';
}

function websiteUrl(lead, meta) {
  const site = lead.website || meta.domain || '';
  if (!site) return '';
  if (/^https?:\/\//i.test(site)) return site;
  return 'https://' + site.replace(/^\/\//, '');
}

function mapLeadToPrefill(lead) {
  const meta = lead.scrape_metadata && typeof lead.scrape_metadata === 'object' ? lead.scrape_metadata : {};
  const trade = mapTrade(lead.trade, meta);
  const site = websiteUrl(lead, meta);

  const fields = {
    'biz-name': lead.business_name || '',
    'biz-short': lead.business_name || '',
    'owner-name': lead.contact_name || meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || '',
    'biz-phone': lead.phone || '',
    'biz-email': lead.email || meta.name_for_emails || '',
    'biz-city': lead.city || '',
    'biz-state': lead.state || '',
    'biz-address': lead.address || meta.street || meta.address || '',
    'biz-zip': lead.zip || '',
    'gbp-link': lead.google_maps_url || meta.location_link || '',
    'scities': lead.city || meta.located_in || '',
    'biz-hours': formatWorkingHours(meta.working_hours || meta.working_hours_csv_compatible),
    'old-url': site,
    'bstory': meta.description || meta.about || '',
    'hero-slogan': meta.website_title || '',
    'hero-subheadline': meta.website_description || '',
  };

  if (lead.google_rating != null) fields.rvrat = nearestRatingOption(Number(lead.google_rating));
  if (lead.google_review_count != null) fields.rvcount = String(lead.google_review_count);

  const radios = {};
  if (lead.google_maps_url || lead.google_place_id) radios.gbp = 'yes-claimed';
  if (site) radios['has-site'] = 'yes';

  const select = {};
  if (trade) select['primary-trade'] = trade;

  return { fields, radios, select };
}
