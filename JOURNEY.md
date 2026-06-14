# Dressit — Build Journey & Decision Log

A running record of how this project evolved and *why* — so the reasoning survives, not just the code.
Newest at bottom. Companion docs: `DRESSIT_ROADMAP.md` (plan), `QUIZ_DESIGN.md` (quiz), `TAGGER_EVAL.md` (tagger results).

---

## Phase 0 — The concept (from StyleMatch_AI_Project_Doc, Mar 2026)
Original idea: AI fashion recommender for D2C brands — upload photo → analyze body/skin tone → recommend.
**Critique that reshaped it:** too much AI, too much complexity, hard to sell, needs merchants before any validation.

## Phase 1 — Pivot to a business shape (v2 doc)
Key realizations:
- **Merchants don't buy "AI" — they buy leads, conversions, and customer data.** (Octane AI proved willingness to pay
  for quiz-commerce: quiz → recommendations → email/zero-party data → Klaviyo.)
- **Catalog auto-tagging = the wedge** (competitors make merchants tag by hand); customer data = the eventual moat.
- Two viable customers: **merchant** (Shopify SaaS) or **shopper** (consumer affiliate site). Same engine.
- **Product is a "Fashion Discovery Platform"** — value is helping people find the right product faster, not the AI.

## Phase 2 — Chose the consumer site first (Dressit)
- Differentiator vs Myntra/Ajio: their huge catalogs bury what you want behind filters you must know how to drive.
  Dressit inverts it — **tap pictures, watch the count fall, get 5 picks.**
- Central question the site must answer: *"why come here instead of Myntra/Ajio/Google?"* (still open — must nail the value prop).
- **Riskiest assumption (unchanged across every version):** will a shopper finish a 6–8 Q quiz and act on the picks?
- Rule carried from RetainHQ: **ship the mechanic, freeze the intelligence.** v0 has no LLM, no backend.
- The browser-extension idea → repackaged as the **Instant Demo** (paste a Shopify URL → quiz over its `/products.json`).

## Phase 3 — Data verification (the afternoon that de-risked everything)
- Probed ~15 Indian D2C stores for the public Shopify `/products.json` feed. **11 of 13 expose it** — no scraping.
- Tag quality is **bimodal**: Bear House 94%, Snitch 85% (well-tagged) vs Bonkers 4%, Littlebox/Offduty/Freakins ~1%.
  → This *validates the tagger wedge with real data*: well-tagged stores = ground truth; blind stores = the product's job.
- **Snitch gotcha:** went headless (Next.js storefront on snitch.com over a Python/SQLAlchemy/Postgres backend that
  leaks raw SQL on bad input — low-sev info disclosure, responsible-disclosure email drafted). The old Shopify backend
  at `snitch.co.in/products.json` is still LIVE and updated daily. Links out via `snitch.com/{cat}/{handle}/{id}/buy`,
  validated by page CONTENT not HTTP status (soft-200s).
- The Souled Store / Myntra / Ajio: not Shopify, no public feed → skip.

## Phase 4 — Normalization (ground truth)
- Pulled full catalogs: **Snitch 10,000**, **Bear House 2,650**.
- `normalize.py`: raw tags → 7-dim schema (category, fit, occasion, color, sleeve, pattern, fabric).
  category from `product_type` (reliable); rest from tags via substring vocab; junk stripped (sale codes, model
  names, supplier names, internal flags). Coverage 90–99% on precision dims (sleeve "low" is correct — bottoms have none).
- Merged into `data/catalog.json`: **11,127 buyable products** with links, price bands, full schema.
  Both stores are **menswear** → tags-only quiz is menswear until the tagger hits a women's store.

## Phase 5 — The VLM tagger
- `tagger.py`: image + title → same schema, same canonical vocab (apples-to-apples scoring). Gemini Flash via REST,
  zero-dep `.env` loader. `check_models.py` confirmed available models (note: no plain `gemini-3.1-flash` exists —
  only `-lite`/`-image`/`-tts`; `gemini-3.5-flash` and `gemini-2.5-flash` also available).
- Validated against Snitch/Bear House human tags (`verify_tagger.py`, 40 products, fixed seed).
- **Three prompt iterations → ACCEPTED** at category 95 / sleeve 100 / pattern ~75 / occasion 84 / fabric 76 /
  color 68(hit)·54(exact) / fit 72, on `gemini-3.1-flash-lite`, ~6.4s/item. Key lesson: many "misses" are wrong
  *store tags*, not model errors — we're at the label-noise ceiling, so stopped tuning. (Full record: `TAGGER_EVAL.md`.)

## Phase 6 — Frontend v0 (counter quiz)
- React + Vite + Tailwind (CDN) on Vercel target; `framer-motion` for the falling-counter animation.
- 8 image-card questions (`quizConfig.js`), client-side filter+rank (`filter.js`): hard filters cut the counter,
  soft prefs drive ranking, never-zero-out relax, title dedupe. Post-Q5 fork. Per-pick 👍/👎 + binary "did we get it?".
- PostHog event contract wired as a `track()` shim (logs to console until a key is added).
- **Logic verified** against the real 11k catalog: counter 11,127 → 4,816 → 2,881 → 1,287 → 767 → 456; picks relevant.
  Visuals NOT yet browser-verified (preview tool was scoped to another project root).

## Phase 7 — Bonkers tagging + women's coverage

- Added Bonkers Corner (bonkerscorner.com) as a 3rd store — ~1,704 products, mix of men + women.
- `tag_store.py` was upgraded significantly:
  - Resume-safe: keys on `link` (not `id` which wasn't stored — `KeyError: 'id'` bug found and fixed).
  - `gender_from_store()` regex on title/tags/type → `"men"/"women"/None`; None falls back to VLM.
  - `gender_src: "store"|"vlm"` stored per row so you know how confident each gender label is.
  - Image URL uses `?width=512` to reduce download size (faster, cheaper).
  - Writes **only** to `data/tagged_<brand>.json` — never touches `catalog.json` directly.
  - `validate_summary()` prints gender mix + per-dim coverage at end of run.
  - Prints: `"NOT merged. Review the file, then run: python merge_catalog.py {brand}"`
- `merge_catalog.py`: backs up to `catalog.bak.json`, backfills `gender="men"` on legacy rows, idempotent
  (removes old brand entries then appends new). `--dry` flag to preview changes.
- **240 Bonkers products tagged and merged** as v1 batch. Remaining ~1,464 queued (checkpoint-resumable).
- Validated 8-row sample: gender split correct, category (shirts/tops/shorts) correct, VLM tags match visuals.

## Phase 8 — Women's quiz + category expansion

- Added women's category cards with `showIf: (a) => a.gender?.values?.includes('women')` (separate from men's
  category question — avoiding a confusing merged list).
- Men's categories expanded: grouped Joggers / Hoodies / Sweatshirts → **"Winter wear"** (values: jacket, hoodie,
  sweatshirt, jogger) to cut decision overload.
- `quizConfig.js` sleeve question `showIf` bug fixed: `(a.category || []).includes(c)` crashed because `a.category`
  is `{label, values}`, not an array. Fixed: `(a.category?.values || []).includes(c)`.
- 94/240 Bonkers rows landed in women's categories (top, coord, dress, skirt) — now surfaced in the quiz.
- Unisex handling: Men card `values: ["men","unisex"]`, Women card `values: ["women","unisex"]` — a unisex hoodie
  matches both without any special-case code.

## Phase 9 — Dynamic card images + quiz polish

- `cardImageFor(catalog, answers, q, card, used)` in `App.jsx`: shows the *chosen* item's variations on
  downstream cards. Choose "Polos" → occasion/fit/color/pattern cards all show polos, not generic shirts.
  - Relaxation ladder: `gender+category+attribute` → `gender+attribute` → `attribute only`.
  - Two-pass: pass 1 skips images already used on this screen (`used = new Set()` per `mappedQ` recompute);
    pass 2 allows reuse only if inventory runs out. Verified: 4/4 distinct occasion, 5/5 pattern, 4/4 color
    cards for Men+Polos path. Same product no longer repeats across cards.
  - `widthify()` appends `?width=400` to Shopify CDN URLs.
- `pick_card_images.py` now generates `cardImages.js` as a **static fallback only** (used before catalog loads).
  The live catalog drives everything post-load.
- `QuizCard` image polish: `aspectRatio: fill ? '4/5' : '3/4'`, `objectPosition: center 28%` (garment crop,
  not feet/head), `filter: saturate(0.96) contrast(1.02)` to normalize mixed product photography.
- `.dz-qcard-img` CSS: slow settle + hover zoom (`scale 1.055`), press-in on `:active`.
- `.dz-quiz-grid`: `align-content: start; overflow-y: auto` — cards scroll, counter stays pinned.
- PostHog wired: `analytics.js` with `autocapture: false`, named funnel events. `VITE_POSTHOG_KEY` in
  `frontend/.env`. CORS failures in local Firefox = tracker blocker; reverse proxy via Vercel rewrites
  deferred to deploy.

---

## Decisions locked
- Consumer site (Dressit) first; Shopify app is the same engine later. No work wasted either way.
- Stack: static React + client-side filtering (v0) → FastAPI/LLM re-rank (v0.5) → offline Gemini tagger (Track B).
- Model for tagging: `gemini-3.1-flash-lite` (cheap, fast, good enough). Sarvam ruled out (Indic text, not vision).
- Tagger accepted as-is; not chasing fit past 72 against noisy labels.
- User runs paid/API commands themselves; assistant analyzes pasted output.
- Tag/review/merge pipeline is intentional — VLM hallucinations never auto-ship to catalog.
- Card images are dynamic (catalog-driven), not static assets. `cardImages.js` = fallback only.

## Open threads (next)
1. **Finish Bonkers tag run** (~1,464 remaining): `python tag_store.py www.bonkerscorner.com bonkers` (checkpoint-safe).
   Then `python merge_catalog.py bonkers` + `python pick_card_images.py` to refresh fallback.
2. **Tag a women's-only store** (e.g., Littlebox, Offduty) — currently 146 women's items in catalog, not enough variety.
3. **Deploy to Vercel**: `git init` DressIt, PostHog reverse proxy in `vercel.json`, slim `catalog.json`
   (~5MB → ~1MB by dropping unused fields), set env vars.
4. **Browser-verify the quiz visuals** (needs Dressit as its own preview/git root — has not been visually confirmed).
5. Nail the one-line value prop ("why Dressit not Myntra").
6. Greenlight thresholds: completion >60%, 👍 >60%, "got your style" >65%, CTR >25%.
7. Send Snitch disclosure email (drafted, ready).
