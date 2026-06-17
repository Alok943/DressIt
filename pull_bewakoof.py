"""
Pull Bewakoof (a fully-custom, non-Shopify store) into data/raw_bewakoof.json, in
the shape tag_store_batch --from-raw expects. Bewakoof has no /products.json and no
sitemap; it serves products from its own API:

  https://api-prod.bewakoof.com/v2/collection/widgets?module=product&filter={}&limit=50&url=<slug>&sort=popular

The endpoint is auth-free but caps at 50 products per collection with no working
pagination — so coverage = (number of collection slugs) x 50, de-duped. Pass the
collection slugs you care about (the path after bewakoof.com/, e.g. a category page
URL bewakoof.com/men-half-sleeve-t-shirts -> slug "men-half-sleeve-t-shirts").

  python pull_bewakoof.py men-half-sleeve-t-shirts womens-dresses womens-denims ...
  python tag_store_batch.py - bewakoof --from-raw --streetwear

Maps: name->title, url->/p/<slug> link, display_image->images.bewakoof.com/t640/<f>,
product_sizes[].available->variant availability, price->variant price.
"""
import json, sys, os, ssl, time, urllib.request, urllib.parse
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
from tag_store import gender_from_store  # to drop off-gender leakage (--women / --men)

CTX = ssl._create_unverified_context()
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
     "Accept": "application/json", "Origin": "https://www.bewakoof.com",
     "Referer": "https://www.bewakoof.com/"}
API = "https://api-prod.bewakoof.com/v2/collection/widgets"
IMG = "https://images.bewakoof.com/t640/"

# Curated women+men collection slugs (bad/empty ones harmlessly return 0). Pair with
# --women or --men to drop the off-gender leakage. Extend with any slug from a
# bewakoof.com category-page URL (the path after the domain).
DEFAULT_SLUGS = [
    # women
    "womens-denims", "womens-t-shirts", "oversized-t-shirts-for-women", "women-dresses",
    "women-shirts", "womens-hoodies", "sweatshirts-for-women", "track-pants-for-women",
    "women-tops", "women-crop-tops", "women-skirts", "women-shorts", "jackets-for-women",
    "tank-tops-for-women", "leggings-for-women", "jumpsuits-for-women",
    # men
    "men-half-sleeve-t-shirts", "men-oversized-t-shirts", "men-full-sleeve-t-shirts",
    "men-shirts", "men-oversized-shirts", "men-jeans", "men-joggers-and-track-pants",
    "men-hoodies", "men-sweatshirts", "men-shorts", "men-cargo-pants", "men-trousers",
    "men-polo-t-shirts", "men-jackets", "men-co-ords", "men-vests",
]


def fetch_collection(slug, tries=4):
    q = urllib.parse.urlencode({"module": "product", "filter": "{}", "limit": 50,
                                "view_more": "true", "url": slug, "sort": "popular"})
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{API}?{q}", headers=H), timeout=30, context=CTX) as r:
                return json.load(r).get("response", {}).get("products", [])
        except Exception as e:
            last = e
            time.sleep(2 * (i + 1))
    print(f"  slug '{slug}' failed: {str(last)[:50]}", flush=True)
    return []


def to_raw(p):
    sizes = p.get("product_sizes") or []
    price = p.get("price")
    variants = ([{"price": price, "available": bool(s.get("available"))} for s in sizes]
                or [{"price": price, "available": bool(p.get("in_stock"))}])
    img = p.get("display_image")
    return {
        "id": p.get("id"),
        "handle": p.get("url"),
        "link": f"https://www.bewakoof.com/p/{p.get('url')}",
        "title": p.get("name"),
        "product_type": "",                       # Bewakoof has none; gender comes from the title
        "tags": [t for t in (p.get("tags") or []) if isinstance(t, str)],  # Bewakoof tags are dicts -> drop
        "variants": variants,
        "images": [{"src": IMG + img}] if img else [],
    }


def main():
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")] or DEFAULT_SLUGS
    print(f"pulling {len(slugs)} Bewakoof collections (<=50 each, de-duped)...", flush=True)
    by_id = {}
    for slug in slugs:
        prods = fetch_collection(slug)
        new = 0
        for p in prods:
            if p.get("id") and p["id"] not in by_id and p.get("display_image"):
                by_id[p["id"]] = to_raw(p)
                new += 1
        print(f"  {slug:32s} {len(prods):3d} returned, +{new} new ({len(by_id)} total)", flush=True)
        time.sleep(0.4)

    rows = list(by_id.values())
    # women's/men's collection slugs aren't strictly gender-filtered server-side;
    # drop the off-gender leakage (title says "Men's"/"Women's") on request
    if "--women" in sys.argv:
        rows = [p for p in rows if gender_from_store(p) != "men"]
    elif "--men" in sys.argv:
        rows = [p for p in rows if gender_from_store(p) != "women"]

    os.makedirs("data", exist_ok=True)
    path = "data/raw_bewakoof.json"
    json.dump({"products": rows}, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nwrote {len(rows)} products -> {path}")
    print("next:  python tag_store_batch.py - bewakoof --from-raw --streetwear")


if __name__ == "__main__":
    main()
