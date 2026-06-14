// Client-side filtering + ranking. Runs in-browser on every tap (instant counter).

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

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

// final ranked picks: hard survivors, scored by how many SOFT prefs they also match
export function rankPicks(catalog, answers, questions, n = 5) {
  const hard = survivors(catalog, answers, questions);
  const softQs = questions.filter((q) => q.soft && answers[q.id]);
  const scored = hard.map((p) => {
    let score = 0;
    for (const q of softQs) if (matches(p, q.dim, answers[q.id].values)) score += 1;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // dedupe near-identical items (same title = color/size variants listed separately)
  const seen = new Set();
  const top = [];
  for (const { p } of scored) {
    const key = p.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    top.push(p);
    if (top.length >= n) break;
  }
  // never-zero-out: if too few unique, backfill allowing dupes
  if (top.length < n) {
    for (const { p } of scored) {
      if (top.length >= n) break;
      if (!top.includes(p)) top.push(p);
    }
  }
  return top;
}
