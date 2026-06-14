"""
Verify the VLM tagger against normalized-tag ground truth (Snitch + Bear House).

Metric per dimension (only over products whose ground truth for that dim is non-empty):
  hit      = predicted set overlaps truth set        (lenient: got at least one right)
  exact    = predicted set == truth set
Reports hit-rate + exact-rate per dimension, plus a few worked examples.

Usage:
  GEMINI_API_KEY=...  python verify_tagger.py 40      # sample size (per brand split)
"""
import sys, json, random, io
from collections import defaultdict
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
import time
from tagger import tag_product, ALLOWED, MODEL

N = int(sys.argv[1]) if len(sys.argv) > 1 else 40
random.seed(7)

# build sample: products WITH an image, biased to ones that have decent ground truth
pool = []
for brand in ("snitch", "bearhouse"):
    norm = json.load(open(f"data/norm_{brand}.json", encoding="utf-8"))
    cand = [p for p in norm if p.get("image") and sum(len(v) for v in p["attrs"].values()) >= 3]
    pool += [(brand, p) for p in random.sample(cand, min(N // 2, len(cand)))]

dims = list(ALLOWED.keys())
hit = defaultdict(int); exact = defaultdict(int); denom = defaultdict(int)
examples = []
fails = 0
t0 = time.time()
print(f"Tagging {len(pool)} products with {MODEL} ... (progress every 10)\n", flush=True)

for i, (brand, p) in enumerate(pool, 1):
    truth = {"category": [p["category"]] if p["category"] else [], **p["attrs"]}
    try:
        pred = tag_product(p["title"], p["image"])
    except Exception as e:
        fails += 1
        print(f"  [{i}] {brand} FAIL: {str(e)[:60]}", flush=True); continue
    for d in dims:
        t, pr = set(truth.get(d, [])), set(pred.get(d, []))
        if not t:
            continue
        denom[d] += 1
        if t & pr: hit[d] += 1
        if t == pr: exact[d] += 1
    if len(examples) < 6:
        examples.append((p["title"], truth, pred))
    if i % 10 == 0:
        el = time.time() - t0
        print(f"  ...{i}/{len(pool)} done  ({el:.0f}s elapsed, {el/i:.1f}s/item, {fails} fails)", flush=True)

print(f"\n{'='*64}\nTAGGER vs GROUND TRUTH  (n={len(pool)} sampled)\n{'='*64}")
print(f"{'dim':10s} {'n':>4s}  {'hit%':>6s}  {'exact%':>7s}")
for d in dims:
    if denom[d]:
        print(f"{d:10s} {denom[d]:4d}  {100*hit[d]/denom[d]:6.1f}  {100*exact[d]/denom[d]:7.1f}")

print("\n-- examples --")
for title, truth, pred in examples:
    print(f"\n{title}")
    for d in dims:
        t, pr = truth.get(d, []), pred.get(d, [])
        mark = "" if set(t) & set(pr) or not t else "  <-- miss"
        print(f"   {d:9s} truth={t}  pred={pr}{mark}")
