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

CTX = ssl._create_unverified_context()
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
     "Accept": "application/json", "Origin": "https://www.bewakoof.com",
     "Referer": "https://www.bewakoof.com/"}
API = "https://api-prod.bewakoof.com/v2/collection/widgets"
IMG = "https://images.bewakoof.com/t640/"

# a starter set — extend with any slug from a bewakoof.com category-page URL
DEFAULT_SLUGS = [
    "new-arrivals",
    "men-half-sleeve-t-shirts", "men-oversized-t-shirts", "men-shirts", "men-jeans",
    "men-joggers-and-track-pants", "men-hoodies", "men-sweatshirts", "men-shorts",
    "womens-t-shirts", "womens-dresses", "womens-tops", "womens-denims",
    "womens-co-ords", "track-pants-for-women", "women-sweatshirts-hoodies",
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
        "product_type": "",                       # Bewakoof has none; gender comes from title/tags
        "tags": p.get("tags") or [],
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

    os.makedirs("data", exist_ok=True)
    path = "data/raw_bewakoof.json"
    json.dump({"products": list(by_id.values())}, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nwrote {len(by_id)} products -> {path}")
    print("next:  python tag_store_batch.py - bewakoof --from-raw --streetwear")


if __name__ == "__main__":
    main()
