// Client-side filtering + ranking. Runs in-browser on every tap (instant counter).

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// Collapse colour variants of the same product into one pick. Snitch links carry a
// base SKU shared across colours (…-4mss4668-03/<variant>/buy); other brands fall back
// to the title with colour words stripped. Without this, results show the same shirt
// several times in different colours. Keep identical to family_key in filter.py.
const COLOR_WORDS = new Set([
  'black', 'white', 'grey', 'gray', 'beige', 'cream', 'olive', 'brown', 'khaki',
  'maroon', 'mustard', 'blue', 'navy', 'teal', 'red', 'pink', 'orange', 'purple',
  'lavender', 'yellow', 'green', 'peach', 'multi', 'wine', 'mauve', 'charcoal',
]);
export function familyKey(p) {
  const link = p.link || '';
  const m = link.match(/-([a-z0-9]+)-\d+\/\d+\/buy\/?$/i);
  if (m) return (p.brand || '') + ':' + m[1].toLowerCase();
  const t = (p.title || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const toks = t.split(/\s+/).filter((w) => w && !COLOR_WORDS.has(w) && !/^\d+$/.test(w));
  return (p.brand || '') + ':' + toks.join(' ');
}

// does a product satisfy one answered card's values on a dimension?
export function matches(product, dim, values) {
  if (!values || values.length === 0) return true; // "no preference" / skip
  const pv = asArray(product[dim]);
  return values.some((v) => pv.includes(v));
}

// survivors after applying all HARD answers so far (soft dims excluded from the count cut)
export function survivors(catalog, answers, questions) {
  return catalog.filter((p) =>
    questions.every((q) => {
      const ans = answers[q.id];
      if (!ans) return true; // unanswered
      if (q.soft) return true; // soft dims don't hard-cut the counter
      return matches(p, q.dim, ans.values);
    })
  );
}

// Round-robin across brands so one big catalog (Snitch) can't dominate the top.
// Brands enter in order of their best-ranked item; we then take one from each in
// turn. Keep identical to interleave_by_brand in filter.py.
export function interleaveByBrand(list) {
  const groups = new Map();
  for (const p of list) {
    const b = p.brand || '';
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push(p);
  }
  const queues = [...groups.values()];
  const out = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const item = q.shift();
      if (item) { out.push(item); added = true; }
    }
  }
  return out;
}

// final ranked picks: hard survivors, scored by how many SOFT prefs they also match,
// deduped to one per product family, then interleaved across brands for variety
export function rankPicks(catalog, answers, questions, n = 5) {
  const hard = survivors(catalog, answers, questions);
  const softQs = questions.filter((q) => q.soft && answers[q.id]);
  const scored = hard.map((p) => {
    let score = 0;
    for (const q of softQs) if (matches(p, q.dim, answers[q.id].values)) score += 1;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // dedupe colour/size variants of the same product (see familyKey)
  const seen = new Set();
  const uniq = [];
  for (const { p } of scored) {
    const key = familyKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(p);
  }
  return interleaveByBrand(uniq).slice(0, n);
}
