const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

const DETAIL_FIELDS = [
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
  'business_status',
].join(',');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!KEY) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Google import is not configured yet. (Missing Places API key.)' }),
    };
  }

  let url = '';
  try {
    url = String(JSON.parse(event.body || '{}').url || '').trim();
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!url) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Google profile URL is required.' }) };
  }

  try {
    const placeId = await resolvePlaceId(url);
    if (!placeId) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          found: false,
          message: 'We could not read that Google link. Try the full Maps URL from your browser address bar, or from Share → Copy link on your Google listing.',
        }),
      };
    }

    const detUrl =
      'https://maps.googleapis.com/maps/api/place/details/json' +
      '?place_id=' + encodeURIComponent(placeId) +
      '&fields=' + DETAIL_FIELDS +
      '&reviews_sort=newest&key=' + KEY;
    const detData = await getJson(detUrl);
    if (detData.status !== 'OK') {
      throw new Error(detData.error_message || ('Places details error: ' + detData.status));
    }

    const p = detData.result || {};
    const prefill = mapPlaceToPrefill(p, url);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        found: true,
        placeId,
        prefill,
        imported: prefill._imported || [],
        message: buildMessage(prefill._imported || []),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Import failed: ' + err.message }),
    };
  }
};

async function getJson(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const r = await fetch(url, { signal: c.signal });
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function extractPlaceIdFromText(text) {
  if (!text) return null;
  var patterns = [
    /[?&]place_id=([^&]+)/i,
    /!1s(ChIJ[A-Za-z0-9_-]+)/,
    /\/place\/(ChIJ[A-Za-z0-9_-]+)/,
    /(ChIJ[A-Za-z0-9_-]{20,})/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

async function resolvePlaceId(url) {
  var direct = extractPlaceIdFromText(url);
  if (direct) return direct;

  var needsFollow = /[?&]cid=|maps\.app\.goo\.gl|goo\.gl\/maps|google\.com\/maps\/place\//i.test(url);
  if (!needsFollow) return null;

  try {
    var res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'AhanaIntake/1.0 (+https://intakes.getahana.com)' },
    });
    var finalUrl = res.url || url;
    var html = await res.text();
    return extractPlaceIdFromText(finalUrl) || extractPlaceIdFromText(html);
  } catch (e) {
    return null;
  }
}

function pickComponent(components, type) {
  if (!Array.isArray(components)) return '';
  var c = components.find(function (x) {
    return Array.isArray(x.types) && x.types.indexOf(type) >= 0;
  });
  return c ? c.long_name || c.short_name || '' : '';
}

function mapTrade(types) {
  if (!Array.isArray(types)) return '';
  var t = types.join(' ').toLowerCase();
  if (t.indexOf('roof') >= 0) return 'Roofing';
  if (t.indexOf('general_contractor') >= 0 || t.indexOf('home_builder') >= 0) return 'General Contracting / Remodeling';
  if (t.indexOf('hvac') >= 0 || t.indexOf('air_conditioning') >= 0 || t.indexOf('heating') >= 0) return 'HVAC / Heating & Cooling';
  if (t.indexOf('plumb') >= 0) return 'Plumbing';
  if (t.indexOf('electric') >= 0) return 'Electrical';
  if (t.indexOf('landscap') >= 0 || t.indexOf('lawn') >= 0) return 'Landscaping / Lawn Care';
  return '';
}

function nearestRatingOption(rating) {
  if (!rating || rating <= 0) return 'No reviews yet';
  var opts = [5.0, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.1, 4.0, 3.9, 3.8, 3.7, 3.6, 3.5, 3.4, 3.3, 3.2, 3.1, 3.0];
  var best = opts[0];
  var diff = Math.abs(rating - best);
  for (var i = 1; i < opts.length; i++) {
    var d = Math.abs(rating - opts[i]);
    if (d < diff) {
      diff = d;
      best = opts[i];
    }
  }
  return best.toFixed(1);
}

function formatHours(weekdayText) {
  if (!Array.isArray(weekdayText) || !weekdayText.length) return '';
  return weekdayText.join(' · ');
}

function mapPlaceToPrefill(p, submittedUrl) {
  var components = p.address_components || [];
  var streetNum = pickComponent(components, 'street_number');
  var route = pickComponent(components, 'route');
  var city = pickComponent(components, 'locality') || pickComponent(components, 'sublocality') || pickComponent(components, 'administrative_area_level_2');
  var state = pickComponent(components, 'administrative_area_level_1');
  var zip = pickComponent(components, 'postal_code');
  var street = [streetNum, route].filter(Boolean).join(' ').trim();
  var phone = p.formatted_phone_number || p.international_phone_number || '';
  var trade = mapTrade(p.types);
  var reviews = Array.isArray(p.reviews) ? p.reviews : [];

  var fields = {
    'biz-name': p.name || '',
    'biz-short': p.name || '',
    'biz-phone': phone,
    'biz-address': street,
    'biz-city': city,
    'biz-state': state.length === 2 ? state.toUpperCase() : state,
    'biz-zip': zip,
    'gbp-link': p.url || submittedUrl,
    'scities': city,
    'biz-hours': formatHours(p.opening_hours && p.opening_hours.weekday_text),
    'old-url': p.website || '',
  };

  if (p.rating) fields.rvrat = nearestRatingOption(Number(p.rating));
  if (p.user_ratings_total != null) fields.rvcount = String(p.user_ratings_total);

  if (reviews[0]) {
    fields['t1n'] = reviews[0].author_name || '';
    fields['t1t'] = reviews[0].text || '';
  }
  if (reviews[1]) {
    fields['t2n'] = reviews[1].author_name || '';
    fields['t2t'] = reviews[1].text || '';
  }

  var radios = { gbp: 'yes-claimed' };
  if (p.website) radios['has-site'] = 'yes';

  var select = {};
  if (trade) select['primary-trade'] = trade;

  var imported = [];
  Object.keys(fields).forEach(function (k) {
    if (fields[k]) imported.push(k);
  });
  Object.keys(radios).forEach(function (k) {
    imported.push(k);
  });
  if (trade) imported.push('primary-trade');

  return {
    fields: fields,
    radios: radios,
    select: select,
    _imported: imported,
  };
}

function buildMessage(imported) {
  if (!imported.length) return 'Found your listing but could not extract details.';
  return 'Imported ' + imported.length + ' field(s) from Google. Please review and edit anything that looks off.';
}
