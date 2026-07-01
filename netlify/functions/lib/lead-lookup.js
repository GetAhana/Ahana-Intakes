const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function resolveLeadId({ leadId, businessName }) {
  const existing = String(leadId || '').trim();
  if (existing) return existing;

  const name = String(businessName || '').trim();
  if (!name || !SUPABASE_URL || !SUPABASE_KEY) return '';

  const lead = await fetchLeadByName(name);
  if (!lead || !namesAlign(lead.business_name, name)) return '';
  return lead.id;
}

module.exports = {
  fetchLeadById,
  fetchLeadByName,
  namesAlign,
  nameScore,
  normalizeName,
  resolveLeadId,
  supabaseRequest,
};
