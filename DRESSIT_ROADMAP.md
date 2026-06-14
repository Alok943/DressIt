# Dressit — Website Implementation Roadmap

> Consumer fashion-discovery site. A style quiz collapses thousands of D2C products
> down to 5 picks in under 30 seconds, then links out to the brand.
> This doc is the **build plan only** — business case lives in `StyleMatch_AI_Project_Doc_v2.docx`.

**Status:** pre-build. Catalog data sources verified (12 Jun 2026). Next artifact = quiz schema + ingest script.
**Domain:** `dressit.in` available (~₹500/yr). `dressit.ai` taken **and** ranking — discoverability tax, name not yet committed.

---

## 1. The bet

Myntra/Ajio have everything; what *you* want is buried under filters you have to know how to drive.
Dressit inverts it: **tap pictures, watch the catalog shrink, get 5 picks.**

- Differentiator = guided discovery for the shopper who can't articulate "oversized but not baggy, smart-casual not formal" in filter language.
- The central question this site must answer (write the one-line value prop before launch): **"Why come here instead of Myntra, Ajio, or Google?"**
- Riskiest assumption (unchanged across every version of this project): **will a shopper finish a 6–8 question quiz and like the picks enough to act?** Everything below exists to answer that cheaply.

Guiding rule: **ship the mechanic, freeze the intelligence.** v0 has no LLM and no backend.

---

## 2. The core mechanic — the counter quiz

```
12,847 products  ─tap─►  1,943  ─tap─►  312  ─tap─►  41  ─tap─►  your 5
```

The falling live count IS the product. Each tap visibly cuts the catalog → feels like progress, builds commitment.

**Design rules:**
- **One decision per screen** (not two) — the count-drop is the dopamine; don't dilute it.
- **Image-card answers** (oversized / gym / party / clean-fit as photos, not text) — visual recognition is faster, kills text-quiz drop-off.
- **Live counter** updates on every tap. Must be instant (0ms) → filtering runs **client-side**.
- **Order questions by discriminating power** — most catalog-splitting question first → counter falls fastest early. (Computed from real tag distributions once catalog is tagged.)
- **Wordplay on a leash:** write the tag filter first, then make the copy fun. A clever question that doesn't cut the catalog is wasted; an ambiguous one corrupts the filter signal.
- Target: **< 30s total, < 45s median.**

**The post-Q5 fork** (converts silent abandonment into measured choice):
> "Show my picks now" vs "2 more questions for sharper picks"

The split rate here may be the single most informative number in the test — it's *revealed* question tolerance.

**Results screen:**
- 5 cards: image + one-line "why this works for you" + add-to-cart/outbound link.
- Per-card 👍 / 👎 (see Metrics — granular, debuggable, seeds future personalization).
- One binary headline after: **"Did we get your style? Yes / Not really."**
- Never gate the outbound links behind feedback — the moment it's a toll booth, response rate and honesty die.

---

## 3. Data layer

**Source:** Shopify `/products.json` feeds (paginated, `?limit=250&page=N`). No scraping, no permission, public.

### Verified sources (12 Jun 2026)

| Brand | Feed | Tag quality (quiz dims) | Notes |
|---|---|---|---|
| **Snitch** | `snitch.co.in/products.json` | **85%** | Headless: feed is live Shopify backend (updated daily); storefront moved to snitch.com |
| **The Bear House** | `thebearhouse.com/products.json` | **94%** | Best occasion data (`Collection_*` tags). Menswear |
| Bombay Shirts | `bombayshirts.com` | 60% | Structured `Key-Value` tags |
| Powerlook | `www.powerlook.in` | 49% | Half junk, half usable |
| Tistabene / Veirdo / House of Rare | — | 12–38% | Recoverable via title/regex parsing (no VLM) |
| Bonkers / Littlebox / Offduty / Freakins | — | ~1–4% | **Need the VLM tagger** (Track B) |
| The Souled Store, Myntra, Ajio | ❌ | — | Not Shopify / no public feed — skip |

**Both confirmed catalogs are menswear** → tags-only v0 is a *menswear* quiz. Mixed-gender needs the tagger on ≥1 women's store.

### Snitch link gotcha (resolved)
Snitch went headless; storefront is Next.js over a Python/SQLAlchemy/Postgres backend.
- Pull data from `snitch.co.in/products.json` (or `/products/{handle}.json` for one product).
- Link out to: `snitch.com/{category}/{handle}/{product_id}/buy` — all 3 parts come from the feed.
- **Validate links by page CONTENT, not HTTP status** — snitch.com returns soft-200s on error pages (leaks raw SQL; low-sev info disclosure, responsible-disclosure email drafted separately).
- Robust approach: harvest exact URLs from `snitch.com/sitemap-products-*.xml` (handle → canonical URL), fall back to the constructed pattern.

### Ingest normalization (per product)
- Strip junk tags: batch codes (`CG-*`), `Model-*`, supplier names (`VIGNESH CREATIONS`, `M SQUARE`), sale events (`BDAYSALE2025`), `size_*` dupes, literal `Test`/`TAG123`.
- Map raw tags → schema dimensions: `fit, occasion, color, pattern, fabric, sleeve, category, price_band`.
- **Availability:** use `any(variant.available)` — NOT first variant (first = size S; sold-out S ≠ sold-out product). Keep per-size availability so the quiz never recommends an unbuyable size.
- Hotlink Shopify CDN image URLs (no storage).
- Emit one static `catalog.json`.

---

## 4. Tech stack

### v0 (week 1–2) — static site, NO backend
| Piece | Choice |
|---|---|
| Frontend | React + Vite + Tailwind on **Vercel** |
| Counter animation | Framer Motion (or CSS) |
| Catalog | **static `catalog.json` bundled with site** (~5–8k products ≈ 1–2 MB gzipped) |
| Filtering + counter | **client-side, in-browser** (0ms taps) |
| Ranking | heuristic scoring (tag-match count, recency, price band) — **no LLM** |
| Ingest | Python script, run manually on laptop → emits `catalog.json` |
| Analytics | **PostHog** snippet (funnel/dwell/drop-off out of the box) |
| Auth / DB | **none** (a quiz with a login is a dead quiz) |

The only thing client-side filtering "costs" is catalog secrecy — irrelevant for a validation test.

### v0.5 (week 2–3) — add the brain, once the mechanic earns it
```
React quiz (Vercel)
  ├─ catalog.json (static, regenerated by ingest script)
  └─ POST /recommend ──► FastAPI (Railway) ──► Groq/Gemini re-rank of filtered 10–20 → top 5 + "why"
```
- FastAPI on Railway (same pattern as RetainHQ). One endpoint: filtered shortlist + answers in → LLM re-rank + one-line "why" out. Client-side filter stays.
- **Free A/B:** randomly serve heuristic vs LLM ranking, compare per-pick 👍 rates → answers "is the AI actually adding anything?"

### Track B (week 2–3) — the VLM tagger (offline scripts, not infra)
- Python + **Gemini Flash**: image + title in → schema JSON out. Batch over a catalog, write into same `catalog.json` format.
- **Validate against Snitch/Bear House human tags** (free ground truth) → accuracy number per dimension *before* trusting it on untagged stores.
- Then tag Bonkers + ≥1 women's store → quiz goes mixed-gender.
- No serving infra until the Shopify-app phase.

**Deliberately absent in all phases here:** Postgres, auth, Docker, ChromaDB, Streamlit.

---

## 5. Build order

| Wk | Track A — quiz | Track B — tagger |
|---|---|---|
| 1 | Ingest script (paginated pull, junk-strip, normalize, link-build) → `catalog.json` for Snitch + Bear House. **Design 8 questions + tag schema against real tag-frequency tables.** | — |
| 2 | Counter quiz UI (React/Vercel) over those tags + PostHog events. Share with first testers. | Tagger v0, validated vs Snitch/Bear House ground truth |
| 3 | Iterate on completion-rate/funnel data. Add v0.5 LLM re-rank + A/B. | Tag Bonkers + 1 women's store → quiz mixed-gender, 6–8 brands |

**Decision gate (end of WP/quiz test):** metrics in hand → commit Shopify port, or run ₹3k consumer-ad experiment if shoppers love it but merchants look like the better channel. Steps 1–3 port straight into the Shopify widget either way — **no work is wasted** regardless of which channel wins.

---

## 6. Metrics & instrumentation

Two layers: **usable** (do they finish?) vs **useful** (are picks good?).

| Signal | Measures | Greenlight (commit before seeing data) |
|---|---|---|
| Completion rate | usable | > 60% of starters finish |
| Per-question drop-off (funnel) | *which* question breaks | look for a **cliff** (one bad question) vs **decay** (too long) |
| Time-per-question (dwell) | confusing vs engaging | long dwell + high drop = confusing Q |
| Per-pick 👍 rate | useful (granular, debuggable) | > 60% of picks 👍 |
| "Did we get your style?" yes | useful (headline, binary) | > 65% yes |
| Click-through to store | true preference (objective) | > 25% of sessions click ≥1 |
| Post-Q5 fork split | revealed question tolerance | (no threshold — pure signal) |

**Felt vs objective** (same split as RetainHQ's `rating`/`recalled`): per-pick 👍 = felt; click-out = objective. They disagree informatively — 👍 + no click = recs right, something else blocks (price/trust); click + no 👍 = recs fine, rating UI is noise.

**Event stream** (all carry `session_id` + timestamp), pipe to **PostHog** — don't hand-build dashboards:
```
quiz_start
question_answered  (q_index, option, dwell_ms, count_shown)
quiz_abandoned     (last_q_index)      ← derived from absence
results_viewed
pick_reaction      (product_id, up|down)
click_out          (product_id)
```

---

## 7. Open questions (next working session)

1. **THE artifact — 8 quiz questions + tag schema, designed together against real Snitch/Bear House tag-frequency distributions.** Everything reads from it: ingest normalization, quiz→filter mapping, counter math (each answer's cut size = real data), LLM re-rank prompt, future "shop by vibe" search. *Blocking — can't render screen 1 without it.*
2. Where does Snitch's `Casual Wear`/`Club Wear`/`Smart Casuals` vs Bear House's `Collection_*` vocab reconcile into one occasion axis?
3. Quiz-completion benchmark to greenlight the Shopify build — pick the number now (>60%).
4. Gemini vs Groq, per stage (tagging vs re-rank) — measure cost+quality on 100 real SKUs.
5. The one-line value prop. If you can't state "why come here not Myntra," the product isn't ready.

---

## Parked (decided, not now)
- Browser extension → superseded by the **Instant Demo** (paste any Shopify URL → quiz over its `/products.json`; proof + sales weapon + onboarding).
- B2C color-analysis micro-tool (viral category; cheapest photo-pipeline validation) → revisit with v1.1 photo analysis.
- Photo upload / skin-tone analysis → v1.1, validated on pilot first (riskiest tech, review-sensitive).
- WhatsApp stylist for India D2C → if/when pursuing Indian brands directly.
- VTON / fit prediction → V2+, try-on only on the final 5 picks (caps GPU cost), marketed as "preview."
- Affiliate monetization (Cuelinks/EarnKaro for Indian fashion) → after traffic exists; commissions can't fund paid acquisition.
