// Optional Gemini helpers. Every function has a non-AI fallback, and AI output is advisory only.
async function gemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

export async function summarizeIncident(
  context: string
): Promise<{ text: string; source: 'gemini' | 'fallback' }> {
  const out = await gemini(
    'You help a lab manager review an equipment incident. Summarise the facts in at most 5 short bullet lines: what happened, ' +
      'condition before vs after, timing, and what a human should check. Do NOT recommend a penalty or decide fault.\n\n' +
      context
  );
  if (out) return { text: out.trim(), source: 'gemini' };
  return {
    text:
      'Automatic summary (AI key not configured):\n' + context.split('\n').slice(0, 8).join('\n'),
    source: 'fallback',
  };
}

const SYNONYMS: Record<string, string[]> = {
  print: ['3d', 'printer', 'printing', 'prototype', 'enclosure'],
  photo: ['camera', 'dslr', 'video', 'shoot', 'film'],
  circuit: ['oscilloscope', 'solder', 'electronics', 'signal', 'pcb'],
  train: ['gpu', 'workstation', 'model', 'deep', 'learning', 'machine'],
  meeting: ['hall', 'seminar', 'room', 'event', 'talk', 'presentation'],
};

function keywordRank(query: string, resources: any[]) {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  const expanded = new Set(words);
  for (const w of words)
    for (const [k, list] of Object.entries(SYNONYMS))
      if (w.startsWith(k) || list.includes(w)) {
        expanded.add(k);
        list.forEach((x) => expanded.add(x));
      }
  return resources
    .map((r) => {
      const hay = `${r.name} ${r.category} ${r.description ?? ''} ${r.rules ?? ''}`.toLowerCase();
      const hits = [...expanded].filter((w) => hay.includes(w));
      return {
        id: r.id,
        score: hits.length,
        reason: hits.length ? `Matches: ${hits.slice(0, 4).join(', ')}` : '',
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ id, reason }) => ({ id, reason }));
}

export async function rankResources(
  query: string,
  resources: any[]
): Promise<{ id: string; reason: string; ai: boolean }[]> {
  const list = resources
    .map((r) => `${r.id} | ${r.name} | ${r.category} | ${(r.description ?? '').slice(0, 120)}`)
    .join('\n');
  const out = await gemini(
    `A student needs: "${query}".\nFrom this resource list pick the best matches (max 4). Reply ONLY with a JSON array like ` +
      `[{"id":"...","reason":"short reason"}].\n\n${list}`
  );
  if (out) {
    try {
      const m = out.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m ? m[0] : out);
      const valid = arr.filter((x: any) => resources.some((r) => r.id === x.id));
      if (valid.length)
        return valid.map((x: any) => ({ id: x.id, reason: String(x.reason ?? ''), ai: true }));
    } catch {
      /* fall through */
    }
  }
  return keywordRank(query, resources).map((x) => ({ ...x, ai: false }));
}
