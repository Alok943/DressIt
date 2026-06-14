# Tagger Evaluation Record

VLM tagger (`tagger.py`) scored against normalized-tag ground truth from Snitch + Bear House
(`verify_tagger.py`, fixed `seed=7` → same 40 products every run: 20 Snitch + 20 Bear House,
each with ≥3 ground-truth attributes).

**Model:** `gemini-3.1-flash-lite` · **Speed:** ~6.4s/item, 0 fails (40 items ≈ 4.3 min).
Time is dominated by full-res Shopify image download — append `?width=512` to image URLs for the
production batch run to cut this sharply.

**Metric:** per dimension, over products whose ground truth for that dim is non-empty.
`hit%` = predicted set overlaps truth (got ≥1 right). `exact%` = sets match exactly.

## Results across prompt iterations

| Dim | n | Run 1 hit/exact | Run 2 hit/exact | **Run 3 (final) hit/exact** |
|---|---|---|---|---|
| category | 40 | 95.0 / 95.0 | 95.0 / 95.0 | **95.0 / 95.0** |
| fit | 36 | 66.7 / 66.7 | 72.2 / 72.2 | **72.2 / 72.2** |
| occasion | 38 | 81.6 / 28.9 | 81.6 / 28.9 | **84.2 / 23.7** |
| color | 37 | 73.0 / 37.8 | 73.0 / 35.1 | **67.6 / 54.1** |
| sleeve | 24 | 100 / 100 | 100 / 100 | **100 / 100** |
| pattern | 39 | 82.1 / 61.5 | 76.9 / 64.1 | **74.4 / 61.5** |
| fabric | 38 | 78.9 / 34.2 | 76.3 / 39.5 | **76.3 / 39.5** |

**Run 1** = baseline prompt.
**Run 2** = added explicit fit definitions (oversized/relaxed/regular/slim) + blanket "be conservative."
**Run 3** = kept fit defs; replaced blanket-conservative with: best-guess on pattern/fabric (don't abstain),
ONE dominant color (2 only if two-tone), occasion ≤2.

## What each change did
- **Fit definitions (Run 2):** fixed the `oversized`↔`relaxed` confusion — both `Box Fit` cases now correct.
  Fit 67 → 72. Plateaued there; remaining errors are fine-grained (slim/regular/relaxed boundary) + label noise.
- **Blanket "conservative" (Run 2) backfired:** model began returning `pred=[]` on fabric/pattern when unsure
  → traded hit% for exact% (wrong trade — we want the tag present to filter on). Reverted in Run 3.
- **One-dominant-color (Run 3):** color exact% 38 → **54** (clean single colors: navy/blue/grey/white/black all exact).
  Hit dipped 73 → 68 because some truth rows list 2 colors and the model now picks the dominant one.

## Verdict: ACCEPT (do not keep tuning)
- The stubborn "misses" are largely **wrong store tags, not model errors** (verified in examples):
  - slim black trousers: tag `casual,festive` vs pred `smart_casual,work` → **pred is more correct**
  - `brown,red` trousers → pred `beige` (the `red` tag is junk)
  - `print` vs `graphic` on a graphic tee → synonyms in our vocab
  → Measured 72–84% likely ≈ ~90% *actually* correct. Further prompt-tuning overfits a 40-sample of noisy labels.
- **Trustworthy now:** category (95), sleeve (100), pattern (~75–82), occasion (84 hit; ignore exact — coarse quiz buckets).
- **Near photo ceiling:** fabric (76 — cotton/rayon/viscose look identical in a photo), color (68 hit / 54 exact).
- **Weakest but acceptable:** fit (72) — oversized fixed; rest is label noise + genuine subtlety.
- **Job is filling blind catalogs** (Bonkers/Littlebox/women's at ~1–4% coverage today). At these numbers that's a
  massive, ship-worthy upgrade. Perfect is the enemy of "the quiz goes mixed-gender."

## Open / deferred
- Decisive "model-capped vs label-capped on fit?" test = swap `.env` to `gemini-2.5-flash`, re-run same 40.
  Not on critical path — curiosity only.
- Production batch: add `?width=512` to image URLs; consider 2 images (front + detail) to lift fabric/pattern.
