const VALID_TRADES = [
  'Roofing',
  'General Contracting / Remodeling',
  'HVAC / Heating & Cooling',
  'Plumbing',
  'Electrical',
  'Landscaping / Lawn Care',
];

const TRADE_MAP = [
  { re: /roof/i, value: 'Roofing' },
  { re: /general|remodel|contract/i, value: 'General Contracting / Remodeling' },
  { re: /hvac|heating|cooling|air condition/i, value: 'HVAC / Heating & Cooling' },
  { re: /plumb/i, value: 'Plumbing' },
  { re: /electric/i, value: 'Electrical' },
  { re: /landscap|lawn/i, value: 'Landscaping / Lawn Care' },
];

const STATE_NAME_TO_CODE = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

const RATING_OPTS = [
  5.0, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.1, 4.0,
  3.9, 3.8, 3.7, 3.6, 3.5, 3.4, 3.3, 3.2, 3.1, 3.0,
];

function trim(val) {
  if (val == null) return '';
  return String(val).trim();
}

function certainEmail(val) {
  const s = trim(val);
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s)) return '';
  return s.toLowerCase();
}

function certainState(val) {
  const s = trim(val);
  if (!s) return '';
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const code = STATE_NAME_TO_CODE[s.toLowerCase()];
  return code || '';
}

function certainZip(val) {
  const s = trim(val);
  if (!s) return '';
  const m = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : '';
}

function certainGoogleMapsUrl(val) {
  const s = trim(val);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) return '';
  if (!/google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(s)) return '';
  return s;
}

function certainOwnerName(lead, meta) {
  const contact = trim(lead.contact_name);
  if (contact && contact.length >= 2) return contact;

  const first = trim(meta.first_name);
  const last = trim(meta.last_name);
  if (first && last) return first + ' ' + last;

  const full = trim(meta.full_name);
  if (full && full.length >= 2) return full;

  return '';
}

function mapTrade(trade, meta, placeTypes) {
  const parts = [trade, meta && meta.type, meta && meta.subtypes];
  if (Array.isArray(placeTypes)) parts.push(placeTypes.join(' '));
  const raw = parts.filter(Boolean).join(' ');
  for (const row of TRADE_MAP) {
    if (row.re.test(raw)) return row.value;
  }
  return '';
}

function certainTrade(trade, meta, placeTypes) {
  const mapped = mapTrade(trade, meta, placeTypes);
  return VALID_TRADES.indexOf(mapped) >= 0 ? mapped : '';
}

function nearestRatingOption(rating) {
  if (!rating || rating <= 0) return '';
  let best = RATING_OPTS[0];
  let diff = Math.abs(rating - best);
  for (let i = 1; i < RATING_OPTS.length; i++) {
    const d = Math.abs(rating - RATING_OPTS[i]);
    if (d < diff) {
      diff = d;
      best = RATING_OPTS[i];
    }
  }
  return best.toFixed(1);
}

function certainRating(leadRating, placeRating) {
  const raw = leadRating != null ? Number(leadRating) : placeRating != null ? Number(placeRating) : null;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return '';
  return nearestRatingOption(raw);
}

function certainReviewCount(leadCount, placeCount) {
  const raw = leadCount != null ? Number(leadCount) : placeCount != null ? Number(placeCount) : null;
  if (raw == null || !Number.isFinite(raw) || raw < 0) return '';
  return String(Math.round(raw));
}

function formatWorkingHours(hours, weekdayText) {
  if (Array.isArray(weekdayText) && weekdayText.length) {
    return weekdayText.map(trim).filter(Boolean).join(' · ');
  }
  if (!hours) return '';
  if (typeof hours === 'string') return trim(hours);
  if (Array.isArray(hours)) return hours.map(trim).filter(Boolean).join(' · ');
  if (typeof hours === 'object') {
    return Object.keys(hours)
      .map(function (day) { return day + ': ' + trim(hours[day]); })
      .filter(function (line) { return line.length > 3; })
      .join(' · ');
  }
  return '';
}

function certainServiceCities(meta, businessCity) {
  const locatedIn = trim(meta.located_in);
  if (locatedIn && locatedIn.toLowerCase() !== businessCity.toLowerCase()) {
    return locatedIn;
  }
  return '';
}

function extractZipsFromText(text) {
  const s = trim(text);
  if (!s) return '';
  const matches = s.match(/\b\d{5}\b/g);
  if (!matches || !matches.length) return '';
  const unique = [];
  matches.forEach(function (z) {
    if (unique.indexOf(z) < 0) unique.push(z);
  });
  return unique.join(', ');
}

function extractYearFromText(text) {
  const s = trim(text);
  if (!s) return '';
  const matches = s.match(/\b(19[5-9]\d|20[0-3]\d)\b/g);
  if (!matches || !matches.length) return '';
  const year = parseInt(matches[0], 10);
  if (year < 1950 || year > 2035) return '';
  return String(year);
}

function certainReviews(placeReviews, businessCity) {
  const out = {};
  if (!Array.isArray(placeReviews)) return out;

  const fiveStar = placeReviews.filter(function (r) {
    return Number(r.rating) === 5 && trim(r.text).length >= 10 && trim(r.author_name).length >= 1;
  });

  if (fiveStar[0]) {
    out['t1n'] = trim(fiveStar[0].author_name);
    out['t1t'] = trim(fiveStar[0].text);
    if (businessCity) out['t1c'] = businessCity;
  }
  if (fiveStar[1]) {
    out['t2n'] = trim(fiveStar[1].author_name);
    out['t2t'] = trim(fiveStar[1].text);
    if (businessCity) out['t2c'] = businessCity;
  }
  return out;
}

function buildSourceCorpus(lead, meta, place) {
  const chunks = [
    lead.business_name,
    lead.contact_name,
    lead.email,
    lead.phone,
    lead.address,
    lead.city,
    lead.state,
    lead.zip,
    lead.trade,
    meta.query,
    meta.subtypes,
    meta.type,
    meta.description,
    meta.about,
    meta.located_in,
    meta.street,
    meta.address,
    meta.working_hours,
    meta.working_hours_csv_compatible,
    place && place.name,
    place && place.formatted_address,
  ];
  if (place && Array.isArray(place.reviews)) {
    place.reviews.forEach(function (r) {
      chunks.push(r.author_name, r.text);
    });
  }
  return chunks.filter(Boolean).join('\n');
}

function evidenceInCorpus(value, corpus) {
  const v = trim(value);
  if (!v) return false;
  return corpus.toLowerCase().indexOf(v.toLowerCase()) >= 0;
}

function mergePrefill(base, extra) {
  const fields = Object.assign({}, base.fields || {});
  const radios = Object.assign({}, base.radios || {});
  const select = Object.assign({}, base.select || {});

  const ef = extra.fields || {};
  Object.keys(ef).forEach(function (k) {
    if (trim(ef[k]) && !trim(fields[k])) fields[k] = ef[k];
  });

  const er = extra.radios || {};
  Object.keys(er).forEach(function (k) {
    if (er[k] && !radios[k]) radios[k] = er[k];
  });

  const es = extra.select || {};
  Object.keys(es).forEach(function (k) {
    if (es[k] && !select[k]) select[k] = es[k];
  });

  return { fields: fields, radios: radios, select: select };
}

function buildStrictPrefill(lead, place) {
  const meta = lead.scrape_metadata && typeof lead.scrape_metadata === 'object' ? lead.scrape_metadata : {};
  const p = place || {};
  const components = p.address_components || [];

  function pickComponent(type) {
    const c = components.find(function (x) {
      return Array.isArray(x.types) && x.types.indexOf(type) >= 0;
    });
    return c ? trim(c.short_name || c.long_name) : '';
  }

  const placeStreet = [pickComponent('street_number'), pickComponent('route')].filter(Boolean).join(' ');
  const placeCity = pickComponent('locality') || pickComponent('sublocality') || pickComponent('administrative_area_level_2');
  const placeState = certainState(pickComponent('administrative_area_level_1'));
  const placeZip = certainZip(pickComponent('postal_code'));

  const businessCity = trim(lead.city) || placeCity;
  const businessState = certainState(lead.state) || placeState;
  const businessZip = certainZip(lead.zip) || placeZip;
  const businessAddress = trim(lead.address) || trim(meta.street) || placeStreet;

  const mapsUrl = certainGoogleMapsUrl(lead.google_maps_url)
    || certainGoogleMapsUrl(meta.location_link)
    || certainGoogleMapsUrl(p.url);

  const hours = formatWorkingHours(
    meta.working_hours || meta.working_hours_csv_compatible,
    p.opening_hours && p.opening_hours.weekday_text
  );

  const corpus = buildSourceCorpus(lead, meta, p);
  const yearText = [meta.description, meta.about].filter(Boolean).join(' ');
  const yearFounded = extractYearFromText(yearText);
  const serviceZips = extractZipsFromText([meta.query, meta.description, meta.about].filter(Boolean).join(' '));

  const fields = {
    'biz-name': trim(lead.business_name),
    'biz-short': trim(lead.business_name),
    'owner-name': certainOwnerName(lead, meta),
    'biz-phone': trim(lead.phone) || trim(p.formatted_phone_number) || trim(p.international_phone_number),
    'biz-email': certainEmail(lead.email) || certainEmail(meta.name_for_emails),
    'biz-city': businessCity,
    'biz-state': businessState,
    'biz-address': businessAddress,
    'biz-zip': businessZip,
    'gbp-link': mapsUrl,
    'scities': certainServiceCities(meta, businessCity),
    'szips': serviceZips,
    'biz-hours': hours,
    'biz-year': yearFounded,
    'rvrat': certainRating(lead.google_rating, p.rating),
    'rvcount': certainReviewCount(lead.google_review_count, p.user_ratings_total),
  };

  Object.assign(fields, certainReviews(p.reviews, businessCity));

  const cleaned = {};
  Object.keys(fields).forEach(function (k) {
    const v = trim(fields[k]);
    if (v) cleaned[k] = v;
  });

  const radios = {};
  if (mapsUrl || lead.google_place_id || p.place_id) radios.gbp = 'yes-claimed';

  const site = trim(lead.website) || trim(meta.domain) || trim(p.website);
  if (site) radios['has-site'] = 'yes';

  const select = {};
  const trade = certainTrade(lead.trade, meta, p.types);
  if (trade) select['primary-trade'] = trade;

  return {
    prefill: { fields: cleaned, radios: radios, select: select },
    corpus: corpus,
    meta: {
      businessCity: businessCity,
      hasPlace: Boolean(p.place_id),
    },
  };
}

function validateNimExtraction(extracted, corpus) {
  const fields = {};
  const allowed = ['scities', 'szips', 'biz-year'];

  allowed.forEach(function (key) {
    const val = trim(extracted && extracted[key]);
    if (!val) return;
    if (key === 'biz-year') {
      if (extractYearFromText(corpus) === val) fields[key] = val;
      return;
    }
    if (key === 'szips') {
      const zips = extractZipsFromText(val);
      if (zips && evidenceInCorpus(zips.split(', ')[0], corpus)) fields[key] = zips;
      return;
    }
    if (key === 'scities') {
      const parts = val.split(/[,;|]/).map(trim).filter(Boolean);
      if (parts.length && parts.every(function (p) { return evidenceInCorpus(p, corpus); })) {
        fields[key] = parts.join(', ');
      }
    }
  });

  return { fields: fields };
}

module.exports = {
  VALID_TRADES,
  buildStrictPrefill,
  validateNimExtraction,
  mergePrefill,
  buildSourceCorpus,
  evidenceInCorpus,
};
