# Dressit — Quiz Option Vocabulary

Reference for quiz labels, subtitles, catalog grouping rationale, and known gaps.  
Counts from `catalog.json` (n = 11,367 · 98% men · 1% women · <1% unisex as of June 2026).

---

## Guiding principles

- **Use terms Indians search by** — not brand-internal jargon. Cross-checked against Myntra, Bewakoof, SNITCH, Bear House, Bonkers Corner, Zara, H&M, Levi's.
- **Use `/` when two terms mean the same thing and both are common** — reduces "I don't know what this means" abandonment.
- **Club when count < ~100 standalone** — keeping options with very few matches creates dead-ends that break quiz trust.
- **Hard dims cut the counter; soft dims only affect ranking.** Dead-ends only happen on hard dims (category, occasion, fit, pattern, band). Soft dims (fabric, color, sleeve) can be incomplete without hurting the experience.

---

## 1. Fit (hard dim)

| Quiz label | Catalog values matched | Count | % | Rationale |
|---|---|---|---|---|
| **Slim fit** | slim, skinny, muscle | 3,266 | 29% | "Slim fit" is the dominant term across all Indian brands. Skinny (40 items) and muscle (0 items in catalog) are correctly absorbed — no "/" needed here. |
| **Regular / Straight fit** | regular, straight, tapered | 3,983 | 35% | "Straight" is how Indians describe jeans fit (Levi's 514, straight-cut chinos). "/" needed: a jeans shopper might skip "Regular" not knowing it covers "straight". Tapered (16 items) too sparse to split out. |
| **Oversized / Baggy** | relaxed, oversized, baggy | 3,240 | 28% | Both terms heavily used on Myntra, Bewakoof, Bonkers, SNITCH. Relaxed (1,424) and Oversized (1,365) are distinct in brand vocabulary (oversized = dropped shoulder; relaxed = extra room but structured) but Indian shoppers use them interchangeably — clubbing is correct. Baggy (451) is the streetwear label for the same silhouette. |

> **Indian brand alignment:** Slim / Regular / Oversized matches exactly what Bear House, Bewakoof, The Souled Store, and SNITCH show on their filter panels. Confirmed against Myntra and Amazon India category pages.

> **Skinny / Tapered note:** Skinny is falling out of favour in 2025–26 (Gen-Z swing toward straight/wide). Tapered (16 items) is a cut detail, not a shopper-facing category — correctly hidden inside "Regular / Straight".

---

## 2. Category — Men (hard dim)

| Quiz label | Catalog values | Count | % | Rationale |
|---|---|---|---|---|
| **Shirts** | shirt | 4,844 | 43% | Collar shirts, button-ups, formal shirts. Largest category by far. |
| **T-shirts** | tshirt | 1,309 | 12% | Crew neck, V-neck, round neck, printed tees. Keeps polo separate because fit and occasion differ. |
| **Polos** | polo | 981 | 9% | Collar tee with pique or waffle texture. Indians recognise "polo" directly (Lacoste effect). |
| **Jeans & Trousers** | jeans, trousers, cargo, shorts | 2,732 | 24% | All bottoms clubbed. If split: jeans (874), trousers (1,381), cargo (273), shorts (204) — cargo and shorts would regularly dead-end after further filtering. |
| **Winter wear** | jacket, sweater, hoodie, sweatshirt, joggers | 761 | 7% | Hoodie (117), sweatshirt (51), sweater (147), jacket (384), joggers (46) — each too sparse to stand alone. Joggers included because they're bought alongside hoodies and winter layering. |

> **Accessories / Shoes:** 347 accessory + 144 shoes items exist in catalog but are not quiz-surfaced. Exclude until catalog deepens — they'd dead-end almost immediately after gender + category + occasion.

---

## 3. Category — Women (hard dim)

| Quiz label | Catalog values | Count | % | Rationale |
|---|---|---|---|---|
| **Tops** | top, tshirt, shirt, polo | ~80 | — | Best-covered women's category, still very thin. |
| **Dresses & Co-ords** | dress, coord, skirt | ~17 | — | dress (3), coord (12), skirt (2) = 17 items total. Will dead-end almost every run. |
| **Bottoms** | jeans, trousers, cargo, shorts, joggers | ~30 | — | Sparse. |
| **Winter wear** | jacket, sweater, hoodie, sweatshirt | ~19 | — | Very sparse. |

> **Known gap — Women's catalog is 146 items (1.3%).** Every path dead-ends quickly. Fix: tag a women's-only store next (priority from CLAUDE.md). Until then, dead-end removal logic in `App.jsx` will suppress options automatically — quiz stays functional but narrow.

---

## 4. Occasion (hard dim)

| Quiz label | Catalog values | Count | % | Rationale |
|---|---|---|---|---|
| **Chill** | casual | 8,170 | 71% | Dominant tag. Home, errands, weekends. No "/" needed — "Chill" is immediately understood. |
| **Smart** | smart_casual, work | 4,432 | 39% | "Smart casual" and "work" overlap heavily in Indian office culture (business casuals, WFH-friendly). Clubbing avoids the brand inconsistency where some stores tag the same shirt "smart_casual" and others tag it "work". |
| **Night out** | party, street | 3,169 | 27% | Party (656) and street (2,513) are different aesthetics but shared occasion — going out at night. "Street" is larger, drives this bucket. |
| **Sharp** | formal, festive | 2,246 | 19% | Weddings, formal events. Formal (1,449) + festive (797). Would dead-end if split — Indian events often blur formal/festive. |

> **Unmapped occasion tags in catalog:** `winter` (652), `travel` (303), `vacation` (194), `lounge` (13), `active` (10) = ~1,172 items (10%) matched by no quiz path. "Winter" appears to be a season tag misapplied as occasion — items already captured by Winter wear category. "Travel" and "vacation" are edge cases; not worth a quiz option yet.

---

## 5. Pattern (hard dim)

| Quiz label | Catalog values | Count | % | Rationale |
|---|---|---|---|---|
| **Solid** | solid | 5,645 | 49% | Half the catalog. Clear standalone. |
| **Textured / Washed** | textured, washed | 1,789 | 15% | "Washed" is a heavy Indian search term (acid wash, stone wash denim, vintage wash shirts). "/" needed: shoppers looking for washed won't recognise "Textured" alone. Washed (40) too sparse standalone. |
| **Stripes** | stripe | 1,172 | 10% | Clear standalone. Vertical, horizontal, diagonal — all called "stripes" uniformly in India. |
| **Checks** | check | 1,101 | 9% | Clear standalone. Gingham, plaid, and flannel all tagged as "check" in catalog. "Plaid" and "windowpane" are too niche for Indian shoppers. |
| **Printed / Graphic** | print, floral, graphic, camo, colorblock, embroidery | 1,685 | 14% | "Graphic" is the term Gen-Z Indian shoppers (SNITCH, The Souled Store) use for logo/illustration tees — "/" helps them recognise this bucket. Individually: print (1,274), embroidery (144), floral (113), graphic (81), colorblock (66), camo (7) — all too sparse to split further. |

---

## 6. Color (soft dim — affects ranking only, never the count)

| Quiz label | Catalog values | Rationale |
|---|---|---|
| **Neutrals** | black, white, grey, beige, cream | Universal foundation; Indians pair these with everything. |
| **Earthy** | olive, brown, khaki, maroon, mustard | Indian skin tone-friendly palette; streetwear staples. |
| **Blues** | blue, navy, teal | Denim-adjacent; navy dominates Indian men's work/smart-casual. |
| **Bold** | red, pink, orange, purple, lavender, yellow, green, peach, multi | Festive, statement, vibrant — appeals to both Gen-Z and ethnic-occasion shoppers. |

> Multi-select. Soft dim — no dead-end risk. "/" not needed here; colors are self-explanatory.

---

## 7. Fabric (soft dim — affects ranking only, never the count)

| Quiz label | Catalog values | Count | % | Rationale |
|---|---|---|---|---|
| **Breezy** | cotton, linen | 7,609 | 67% | Cotton (6,826) dominates the Indian D2C catalog — climate-driven. Linen (783) is the warm-weather premium tier. Both = light, breathable. |
| **Cozy** | knit, fleece, wool, terry | 1,637 | 14% | Sweater-knit (1,621), fleece/wool/terry each <10 items — correctly absorbed. |
| **Structured** | denim, twill, oxford | 1,042 | 9% | Denim (841) drives this. Twill (193) and oxford (8) are the structured non-denim options. |

> **Known gap — Polyester (2,263 items, 19%) is not captured by any fabric option.** Polyester and polyester-blend tees/shirts get zero fabric ranking signal. This is acceptable since fabric is a soft dim — they're not excluded, just not boosted. If womenswear grows or athleisure is added, consider a "Synthetic / Active" option (polyester + nylon + rayon = 3,330 items, 29%).

---

## 8. Sleeve (soft dim)

Shown only when category includes shirt, tshirt, or polo.

| Label | Values | Note |
|---|---|---|
| **Half** | half | Half-sleeve / short-sleeve — dominant Indian preference (climate). |
| **Full** | full | Full-sleeve / long-sleeve — office, winter, formal. |
| **No preference** | — | Skip; does not filter or rank. |

---

## 9. Budget (hard dim)

| Label | Band | Approx price range | Rationale |
|---|---|---|---|
| **Under ₹1.2k** | budget | < ₹1,200 | Bewakoof, The Souled Store price range. |
| **₹1.2k–2k** | mid | ₹1,200–₹2,000 | SNITCH, Bear House, Bonkers price range. |
| **Premium** | premium | > ₹2,000 | Mufti, brand collaborations, premium cuts. |

---

## Summary — "/" decisions

| Question | Label | "/" used? | Why |
|---|---|---|---|
| Fit | Regular / Straight fit | ✓ | "Straight" is how Indians describe jeans fit |
| Fit | Oversized / Baggy | ✓ | Both heavy search terms on Myntra, Bewakoof, Bonkers |
| Pattern | Textured / Washed | ✓ | "Washed" is a distinct aesthetic Indians search for |
| Pattern | Printed / Graphic | ✓ | "Graphic" is Gen-Z vocabulary for illustration/logo tees |
| All others | — | — | Single term is already universally understood |

---

## Summary — clubbing decisions

| Combined into | What's inside | Why not separate |
|---|---|---|
| Regular / Straight fit | regular + straight + tapered | tapered = 16 items; straight = 2%, maps to same intent as regular |
| Oversized / Baggy | relaxed + oversized + baggy | Indian shoppers treat these interchangeably; combined = 28% |
| Jeans & Trousers | jeans + trousers + cargo + shorts | cargo = 2%, shorts = 1% — dead-end after further filtering |
| Winter wear | jacket + hoodie + sweatshirt + sweater + joggers | individually 1–3% each |
| Sharp | formal + festive | Indian events blur the line; combined = 19% |
| Printed / Graphic | print + floral + graphic + camo + colorblock + embroidery | graphic = 0.7%, camo = 0.06% — individually below dead-end threshold |
| Textured / Washed | textured + washed | washed = 40 items (0.3%) |
| Cozy | knit + fleece + wool + terry | fleece=1, wool=6, terry=9 |
| Structured | denim + twill + oxford | oxford=8 items |
