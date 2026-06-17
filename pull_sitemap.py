"""
Pull a Shopify store's catalog via its SITEMAP + per-product .json, for stores that
block the usual /products.json collection feed (e.g. Nobero) but are still Shopify
underneath (images on cdn.shopify.com). Writes data/raw_<brand>.json in the SAME
shape tag_store / tag_store_batch expect, so you then tag with --from-raw:

  python pull_sitemap.py nobero.com nobero
  python tag_store_batch.py - nobero --from-raw --streetwear

How it works: sitemap.xml -> sitemap_products_*.xml -> every /products/<handle> URL
-> fetch <url>.json -> keep the Shopify `product` object. NOTE: per-product .json
often omits variant `available`, so we can't filter sold-out items here (treated as
available); that's a minor cost vs. not being able to ingest the store at all.

NOT for fully-custom storefronts (Bewakoof: no sitemap, no JSON-LD) — those need a
per-brand adapter against their internal API (find it via browser DevTools - Network).
"""
import json, sys, os, ssl, re, time, gzip, urllib.request
from concurrent.futures import ThreadPoolExecutor
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

CTX = ssl._create_unverified_context()
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "application/json,text/xml,*/*"}


def fetch(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30, context=CTX) as r:
                raw = r.read()
            if url.split("?")[0].endswith(".gz"):
                try: raw = gzip.decompress(raw)
                except Exception: pass
            return raw
        except Exception as e:
            last = e
            time.sleep(2 * (i + 1))
    raise last


def product_sitemaps(host):
    """Follow sitemap.xml -> all product sub-sitemap URLs (keep their query strings)."""
    idx = fetch(f"https://{host}/sitemap.xml").decode("utf-8", "replace")
    locs = [u.replace("&amp;", "&") for u in re.findall(r"<loc>(.*?)</loc>", idx)]
    subs = [u for u in locs if "sitemap_products" in u]
    return subs or [f"https://{host}/sitemap_products_1.xml"]


def product_urls(host):
    urls = []
    for sm in product_sitemaps(host):
        txt = fetch(sm).decode("utf-8", "replace")
        urls += [u.replace("&amp;", "&").split("?")[0]
                 for u in re.findall(r"<loc>(.*?)</loc>", txt) if "/products/" in u]
    # de-dupe, preserve order
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u); out.append(u)
    return out


def to_raw(prod):
    """Coerce the Shopify product object to the fields the tagger reads."""
    variants = prod.get("variants") or [{}]
    for v in variants:
        if v.get("available") is None:      # per-product .json often omits it
            v["available"] = True
    return {
        "id": prod.get("id"),
        "handle": prod.get("handle"),
        "title": prod.get("title"),
        "product_type": prod.get("product_type"),
        "tags": prod.get("tags") or [],
        "variants": variants,
        "images": prod.get("images") or [],
    }


def main():
    if len(sys.argv) < 3:
        print("usage: python pull_sitemap.py <host> <brand> [--limit N]")
        return
    host, brand = sys.argv[1], sys.argv[2]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 10**9

    urls = product_urls(host)[:limit]
    print(f"{len(urls)} product URLs from {host} sitemap; fetching per-product .json ...", flush=True)

    out, fails = [], 0
    def one(u):
        try:
            d = json.loads(fetch(u + ".json").decode("utf-8", "replace"))
            p = d.get("product")
            return to_raw(p) if p else None
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, r in enumerate(ex.map(one, urls), 1):
            if r: out.append(r)
            else: fails += 1
            if i % 200 == 0:
                print(f"  ...{i}/{len(urls)} ({fails} fails)", flush=True)

    os.makedirs("data", exist_ok=True)
    path = f"data/raw_{brand}.json"
    json.dump({"products": out}, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nwrote {len(out)} products ({fails} fails) -> {path}")
    print(f"next:  python tag_store_batch.py - {brand} --from-raw [--streetwear]")


if __name__ == "__main__":
    main()
