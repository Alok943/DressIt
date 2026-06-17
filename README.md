# Dressit

**Find clothes you'll actually wear.** A 30-second visual style quiz narrows 11k+ Indian D2C
products down to your edit — tap pictures, watch a live counter fall, get the full matching set.
Myntra/Ajio bury what you want behind filters you must know how to drive; Dressit inverts it.

> Solo build. Consumer site first; the same filter/rank engine becomes a Shopify merchant app later.

---

## How it works

1. **Tap your vibe** — gender, category, occasion, fit, pattern, colour, budget. Quick visual taps, no
   typing. Each hard answer cuts a live counter in real time.
2. **Or search** — type "black oversized tee for work"; it pre-fills the quiz and drops you at the first
   question you haven't answered.
3. **Get your edit** — the full matching set, ranked, revealed a batch at a time ("Show more"),
   filterable by brand and colour. 👍/👎 to sharpen.

---

## Architecture

```
React SPA (Vercel)  ──fetch (4s timeout)──►  FastAPI (Railway → Render)  ──reads──►  catalog.json (in-memory)
   client-side filter+rank                      /api/picks  (filter + rank, optional Groq re-rank)
   (instant counter, offline fallback)          /api/react  (👍/👎 → reactions.jsonl)
```

- **`frontend/`** — React + Vite + Tailwind (CDN). Filters/ranks client-side for the instant counter;
  calls the backend for final picks with a 4s timeout, then **falls back to identical client-side logic**
  (so a sleeping free-tier backend never hangs the page).
- **`backend/`** — FastAPI (Python 3.10+), stdlib-only. Loads `catalog.json` once at startup. No DB —
  reactions append to `reactions.jsonl`.
- **No auth, no database.** `catalog.json` is a static file produced offline by the tagger pipeline.

**One filter logic, two languages, kept identical:** `frontend/src/filter.js` ≡ `backend/app/filter.py`.

---

## The data pipeline

The catalog is built offline by tagging Indian D2C stores. **Tag → review → merge** is deliberate: a
VLM never auto-ships — you eyeball `data/tagged_<brand>.json` before `merge_catalog.py`.

| Source type | Tool | Example |
|---|---|---|
| Shopify, open `/products.json` | `tag_store.py` / `tag_store_batch.py` | Snitch, Vastrado, Freakins |
| Shopify, feed blocked | `pull_sitemap.py` → `--from-raw` | Nobero |
| Fully custom platform | per-brand adapter → `--from-raw` | Bewakoof (`pull_bewakoof.py`) |

Everything downstream only needs `data/raw_<brand>.json` in the Shopify product shape, so any ingester
that emits that shape plugs in. Tagging uses Gemini (VLM, image+title → 7-dim schema); the **Batch API**
path (`tag_store_batch.py`) is ~50% cheaper for bulk.

---

## Quick start

```powershell
# frontend
cd frontend; npm install; npm run dev      # http://localhost:5173
cd frontend; npm run build                 # build-verify changes

# backend
cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload   # :8000/docs

# pipeline (tagging costs Gemini calls; pulls are free)
python pull_bewakoof.py --women                                # ingest → data/raw_bewakoof.json
python tag_store_batch.py - bewakoof --from-raw                # tag (batch, ~50% cheaper)
python merge_catalog.py bewakoof                               # review, then merge into catalog.json
python pick_card_images.py                                     # refresh static fallback art
```

Restart/redeploy the backend after a merge (it loads `catalog.json` at startup).

### Environment (`.env`, git-ignored)
- Root (tagger): `GEMINI_API_KEY`, `GEMINI_MODEL`
- Frontend: `VITE_API_BASE_URL`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`
- Backend: `GROQ_API_KEY`, `GROQ_MODEL`, `RERANKER_ENABLED`, `CORS_ORIGINS`

---

## Data model

Each product in `catalog.json`:
`id, brand, title, price, band (budget <1200 / mid <2000 / premium), image, link,
gender (men/women/unisex), category, fit, occasion, color, sleeve, pattern, fabric`.
Some fields are arrays; matchers handle both. **Hard dims** (gender, category, occasion, fit, pattern,
band) cut the counter; **soft dims** (color, sleeve, fabric) only affect ranking.

---

## Repo docs

- `CLAUDE.md` — full project context & conventions (start here for development)
- `QUIZ_DESIGN.md` / `QUIZ_OPTIONS.md` — quiz flow and the option-vocabulary rationale
- `JOURNEY.md` — decision log · `DRESSIT_ROADMAP.md` — roadmap · `TAGGER_EVAL.md` — tagger accuracy

## Status

11.4k products live across Snitch, Bear House, Bonkers (partial). Bonkers (1.9k), Vastrado, Offduty,
Powerlook, and Bewakoof (women + men) tagged or queued. The active priority is **womenswear** — the
catalog is ~98% men, so the Women's quiz path is being filled out (Bewakoof women's + Littlebox/Freakins).
