const WEBHOOKS = {
  starter: { url: 'Starter_Webhook', apiKey: 'Make_API' },
  enhanced: { url: 'Enhanced_Webhook', apiKey: 'Make_API' },
  premium: { url: 'Premium_Webhook', apiKey: 'Make_API' },
};

const { resolveLeadId } = require('./lib/lead-lookup');
const { expandIntakeForMake } = require('./lib/intake-webhook-expand');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Invalid JSON' }),
    };
  }

  const formType = String(body.formType || '').toLowerCase();
  delete body.formType;

  const config = WEBHOOKS[formType];
  const webhookUrl = config ? process.env[config.url] : '';
  const apiKey = config ? process.env[config.apiKey] : '';

  if (!config || !webhookUrl) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Form handler not configured' }),
    };
  }

  try {
    const biz = body.business || {};
    const resolvedLeadId = await resolveLeadId({
      leadId: body.leadId,
      businessName: biz.legalName || biz.publicName,
    });
    if (resolvedLeadId) body.leadId = resolvedLeadId;

    const webhookPayload = expandIntakeForMake(body);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-Make-ApiKey'] = apiKey;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Upstream webhook rejected the request' }),
      };
    }

    archiveSubmission(formType, body, event.headers).catch(function (err) {
      console.error('intake_submissions archive failed', err.message);
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Failed to reach webhook' }),
    };
  }
};

async function archiveSubmission(formType, payload, headers) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const biz = payload.business || {};
  const leadId = String(payload.leadId || '').trim() || null;
  const submittedAt = payload.submittedAt || new Date().toISOString();
  const host = headerValue(headers, 'host') || headerValue(headers, 'x-forwarded-host') || '';

  const row = {
    form_type: formType,
    lead_id: leadId,
    business_name: biz.legalName || biz.publicName || null,
    owner_name: biz.ownerName || null,
    email: biz.email || null,
    phone: biz.phone || null,
    payload: payload,
    submitted_at: submittedAt,
    source_host: host || null,
  };

  const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/intake_submissions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Supabase insert ' + res.status + ': ' + text.slice(0, 200));
  }
}

function headerValue(headers, name) {
  if (!headers) return '';
  const key = Object.keys(headers).find(function (k) { return k.toLowerCase() === name; });
  return key ? String(headers[key] || '').trim() : '';
}
