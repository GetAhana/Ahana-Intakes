const WEBHOOKS = {
  starter: { url: 'Starter_Webhook', apiKey: 'Make_API' },
  enhanced: { url: 'Enhanced_Webhook', apiKey: 'Make_API' },
  premium: { url: 'Premium_Webhook', apiKey: 'Make_API' },
};

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

  if (!config || !webhookUrl || !apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Form handler not configured' }),
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Make-ApiKey': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Upstream webhook rejected the request' }),
      };
    }

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
