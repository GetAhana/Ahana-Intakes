/**
 * Make.com often only binds the first element from webhook JSON arrays.
 * Expand list-shaped intake data to root-level indexed scalars (+ _count / _joined).
 */

function strArr(v) {
  if (!Array.isArray(v)) return [];
  return v.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
}

function indexedStrings(prefix, items, slots) {
  const list = strArr(items);
  const out = {};
  out[prefix + '_count'] = list.length;
  out[prefix + '_joined'] = list.join('\n');
  for (let i = 1; i <= slots; i++) {
    out[prefix + '_' + i] = list[i - 1] || '';
  }
  return out;
}

function collectServices(services) {
  if (!services || typeof services !== 'object') return [];
  const out = [];
  for (let i = 1; i <= 10; i++) {
    const entry = services['service' + i];
    if (!entry || typeof entry !== 'object') continue;
    const name = String(entry.name || '').trim();
    const desc = String(entry.desc || '').trim();
    if (name || desc) out.push({ name: name, desc: desc });
  }
  return out;
}

function indexedServices(services, slots) {
  slots = slots || 10;
  const list = collectServices(services);
  const out = {
    services_list: list,
    services_count: list.length,
  };
  for (let i = 1; i <= slots; i++) {
    const item = list[i - 1] || {};
    out['service_' + i + '_name'] = item.name || '';
    out['service_' + i + '_desc'] = item.desc || '';
  }
  return out;
}

function indexedTestimonials(testimonials, slots) {
  slots = slots || 8;
  const list = Array.isArray(testimonials) ? testimonials : [];
  const out = { testimonials_count: list.length };
  for (let i = 1; i <= slots; i++) {
    const t = list[i - 1] && typeof list[i - 1] === 'object' ? list[i - 1] : {};
    out['testimonial_' + i + '_name'] = String(t.name || '').trim();
    out['testimonial_' + i + '_city'] = String(t.city || '').trim();
    out['testimonial_' + i + '_text'] = String(t.text || '').trim();
  }
  return out;
}

function indexedUsp(usp, slots) {
  slots = slots || 3;
  const list = Array.isArray(usp) ? usp : [];
  const out = { usp_count: list.length };
  for (let i = 1; i <= slots; i++) {
    const u = list[i - 1] && typeof list[i - 1] === 'object' ? list[i - 1] : {};
    out['usp_' + i + '_title'] = String(u.title || '').trim();
    out['usp_' + i + '_detail'] = String(u.detail || '').trim();
  }
  return out;
}

function expandIntakeForMake(payload) {
  const base = payload && typeof payload === 'object' ? payload : {};
  const seo = base.seo && typeof base.seo === 'object' ? base.seo : {};
  const story = base.story && typeof base.story === 'object' ? base.story : {};
  const photos = base.photos && typeof base.photos === 'object' ? base.photos : {};

  return Object.assign({}, base, indexedServices(base.services), indexedTestimonials(base.testimonials), indexedUsp(story.usp), indexedStrings('primary_keyword', seo.primaryKeywords, 6), indexedStrings('extended_hub_keyword', seo.extendedHubKeywords, 10), indexedStrings('story_value', story.values, 8), indexedStrings('gallery_url', photos.galleryUrls, 25), indexedStrings('team_url', photos.teamUrls, 8), indexedStrings('truck_url', photos.truckUrls, 8), indexedStrings('inspiration_url', seo.inspirationUrls, 8));
}

module.exports = {
  expandIntakeForMake,
  indexedStrings,
  collectServices,
};
