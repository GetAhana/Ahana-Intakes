const NVIDIA_API = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4-flash';

async function extractIntakeFields(sourceBundle) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You extract intake form fields from verified business data only.

Rules:
- Return ONLY valid JSON with keys: scities, szips, biz-year (use empty string when unknown).
- NEVER invent, infer, or guess. If not explicitly stated in the source, return "".
- scities: comma-separated towns/neighborhoods ONLY if named in query, description, about, or located_in.
- szips: comma-separated 5-digit ZIP codes ONLY if they appear verbatim in the source text.
- biz-year: 4-digit founding year ONLY if explicitly stated (e.g. "since 2015", "established 2008").
- Do not include business city alone as a service area unless other towns are also listed.`;

  const userPrompt = 'Extract only fields you can support with explicit evidence in this source bundle:\n\n'
    + JSON.stringify(sourceBundle, null, 2);

  let res;
  try {
    res = await fetch(NVIDIA_API, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.05,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    console.error('NIM intake fetch failed', err.message);
    return null;
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('NIM non-JSON response', res.status, text.slice(0, 300));
    return null;
  }

  if (!res.ok) {
    console.error('NIM error', data);
    return null;
  }

  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    return {
      'scities': String(parsed.scities || parsed.service_cities || '').trim(),
      'szips': String(parsed.szips || parsed.service_zips || '').trim(),
      'biz-year': String(parsed['biz-year'] || parsed.biz_year || parsed.year_started || '').trim(),
    };
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return {
        'scities': String(parsed.scities || '').trim(),
        'szips': String(parsed.szips || '').trim(),
        'biz-year': String(parsed['biz-year'] || parsed.biz_year || '').trim(),
      };
    } catch {
      return null;
    }
  }
}

module.exports = { extractIntakeFields, MODEL };
