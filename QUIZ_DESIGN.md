# Dressit — Quiz Design v1

Designed against the real merged catalog: **11,127 buyable products** (8,481 Snitch + 2,646 Bear House, menswear).
Counter math uses actual distributions from `data/catalog.json`. Each Q maps to a hard filter on the schema.

## Ordering principle
Most catalog-splitting question first → counter falls fastest early (max drama).
Filters AND together; counter = products surviving all answers so far.

## The 8 screens (one decision each, image cards)

| # | Question (wordplay) | Answer cards → filter | Why here / cut |
|---|---|---|---|
| 1 | **"What are you here for?"** | shirt / tshirt / trousers-jeans / jacket-overshirt / polo | `category` | Biggest cut: 11,127 → ~4,800 (shirt) etc. One tap halves+ the catalog |
| 2 | **"Where's this headed?"** | chill (casual) / smart (smart_casual) / night out (party+street) / sharp (formal) | `occasion` | Casual=7.9k, smart=3.7k — splits the survivors hard |
| 3 | **"How do you like it to sit?"** | fitted (slim) / true-to-size (regular) / loose (relaxed+oversized+baggy) | `fit` | regular 3.6k / slim 3.1k / loose ~3.1k — near-even 3-way, great counter drop |
| 4 | **"Plain or with personality?"** | clean (solid) / texture / stripes / checks / printed | `pattern` | solid 5.5k vs rest — strong split |
| 5 | **"Your palette?"** (multi-tap ok) | neutrals (black/white/grey/beige) / earthy (olive/brown/khaki) / blues / bold (red/pink/etc) | `color` group | colors are scattered; group into 4 buckets so each cuts meaningfully |
| — | **FORK** after Q5 | "Show my picks" vs "2 more for sharper picks" | — | measures revealed question tolerance |
| 6 | **"Budget comfort?"** | under ₹1.2k / ₹1.2–2k / premium | `band` | budget 5.1k / mid 5.1k / premium 0.8k — clean halving |
| 7 | **"Sleeve mood?"** (tops only; skip for bottoms) | half / full / no preference | `sleeve` | only shown if Q1 = top; else auto-skip |
| 8 | **"Fabric feel?"** (optional, soft filter) | breezy (linen/cotton) / structured (denim/twill) / cozy (knit/fleece) / no pref | `fabric` | weakest signal → last, skippable, "no pref" prominent |

## Filter behavior rules
- **Hard filters:** Q1–Q4, Q6. **Soft/skippable:** Q5 (multi), Q7 (conditional), Q8 (optional).
- **Never zero out:** if a filter would drop survivors below 5, relax the *most recent soft* filter and flag "widened to show options."
- **Counter shows survivors after each tap** — that number is logged (`count_shown`) for the abandonment funnel.
- After Q8 (or fork-exit): rank survivors → top 5. v0 rank = (# soft-filter matches) + recency tiebreak. v0.5 = LLM re-rank + "why."

## Known gaps (from the data)
- **Menswear only** until tagger hits a women's store — Q1 cards are men's categories.
- **occasion** is the noisiest dim (tag-derived, subjective) — Q2 buckets are deliberately coarse.
- **color** coverage 93–97% but values scatter; bucketing into 4 groups is what makes Q5's counter move.
- `premium` band is thin (782) — premium-tappers may hit the <5 floor; relax-rule covers it.

## Open
1. Image cards: need 2–3 representative product photos per answer (pull from catalog by filter).
2. Exact color-bucket membership (where does navy go — blues or neutrals?).
3. Validate Q-ordering empirically: log per-Q `count_shown` drop, reorder if a Q cuts less than expected on real sessions.
