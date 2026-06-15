"""
Batch-tag a blind/under-tagged store with the VLM tagger. Writes ONLY to
data/tagged_<brand>.json — does NOT touch the live catalog (review first, then merge_catalog.py),
so a VLM hallucination can't auto-ship.

Run (costs API calls — user runs this):
  python tag_store.py www.bonkerscorner.com bonkers --limit 300   # tag up to 300 NEW this run
  python tag_store.py www.bonkerscorner.com bonkers               # full catalog

--limit = how many NEW (untagged) products to tag this run, NOT how many feed items to pull.
The whole feed is always pulled; already-tagged + sold-out + imageless items are skipped, then
the next `--limit` untagged products are tagged. Re-run to grab the next batch (resume-safe).

Pulls the feed, tags each product image+title with tagger.py (gemini via .env), derives gender
from the store's own tags/title (VLM fallback), prints a validation summary.
Progress every 10, resumable (skips links already in data/tagged_<brand>.json).
Then review the file and run:  python merge_catalog.py <brand>
"""
import json, sys, io, os, ssl, time, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
from tagger import tag_product, MODEL

CTX = ssl._create_unverified_context()
# A complete, realistic browser header set. Bonkers Corner (and other Cloudflare-fronted
# stores) 403 an incomplete UA — the string must include AppleWebKit/.../Safari and be
# paired with Accept/Accept-Language, or the bot filter rejects products.json.
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def band(p):
    return None if p is None else ("budget" if p < 1200 else "mid" if p < 2000 else "premium")

import re
_WOMEN = re.compile(r"\bwomen|\bwoman\b|\bgirl|womens\b|\bher\b|\bladies", re.I)
_MEN = re.compile(r"\bmen\b|\bmens\b|\bman\b|\bboys?\b|\bhis\b", re.I)
def gender_from_store(p):
    """Derive gender from the store's own title/tags/type. Returns men/women/None (None -> let VLM decide)."""
    blob = f"{p.get('title','')} {p.get('product_type','')} {' '.join(p.get('tags',[]))}"
    w, m = bool(_WOMEN.search(blob)), bool(_MEN.search(blob))
    if w and not m: return "women"
    if m and not w: return "men"
    return None  # ambiguous or silent -> VLM fallback

def tag_with_retry(title, image_url, tries=3):
    """Retry transient network/SSL/DNS errors with backoff; raise after `tries`."""
    last = None
    for i in range(tries):
        try:
            return tag_product(title, image_url)
        except Exception as e:
            last = e
            time.sleep(2 * (i + 1))  # 2s, 4s
    raise last

def validate_summary(results):
    from collections import Counter
    n = len(results)
    if not n: return
    print(f"\n--- validation ({n} products) ---")
    nocat = [r for r in results if not r.get("category")]
    print(f"  missing category: {len(nocat)}  (should be ~0; investigate if high)")
    print(f"  gender: {dict(Counter(r.get('gender') for r in results))}  "
          f"(src store/vlm: {dict(Counter(r.get('gender_src') for r in results))})")
    for d in ["fit", "occasion", "color", "pattern", "fabric"]:
        cov = sum(1 for r in results if r.get(d)) / n
        print(f"  {d:9s} coverage {cov*100:4.0f}%")
    print("  spot-check 5 random rows in the file before merging.")

def pull_all(host):
    """Pull the ENTIRE feed (all pages). Limiting happens later, on NEW tags."""
    out, page = [], 1
    while True:
        url = f"https://{host}/products.json?limit=250&page={page}"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25, context=CTX) as r:
                prods = json.load(r).get("products", [])
        except Exception as e:
            print(f"  pull page {page} fail: {e}"); break
        if not prods: break
        out += prods; page += 1; time.sleep(0.3)
    return out

def main():
    if len(sys.argv) < 3:
        print("usage: python tag_store.py <host> <brand> [--limit N]"); return
    host, brand = sys.argv[1], sys.argv[2]
    limit = 100000  # max NEW products to tag this run
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    tagged_path = f"data/tagged_{brand}.json"
    done = {}
    if os.path.exists(tagged_path):
        # key on link (stable, present in old + new rows) so resume survives schema tweaks
        done = {x["link"]: x for x in json.load(open(tagged_path, encoding="utf-8")) if x.get("link")}
        print(f"resuming: {len(done)} already tagged")

    prods = pull_all(host)
    todo = sum(1 for p in prods if f"https://{host}/products/{p.get('handle')}" not in done)
    print(f"pulled {len(prods)} from {host}; {todo} untagged, tagging up to {limit} this run "
          f"with {MODEL} ...\n", flush=True)

    results = list(done.values())
    t0, n, fails = time.time(), 0, 0
    for p in prods:
        if n >= limit:
            break  # hit this run's NEW-tag budget; re-run to continue
        link = f"https://{host}/products/{p.get('handle')}"
        if link in done:
            continue
        variants = p.get("variants", [])
        if not any(v.get("available") for v in variants):
            continue
        img = (p.get("images") or [{}])[0].get("src")
        if not img:
            continue
        tag_img = img + ("&" if "?" in img else "?") + "width=512"  # smaller -> faster + fewer drops
        try:
            attrs = tag_with_retry(p.get("title", ""), tag_img)
        except Exception as e:
            fails += 1; print(f"  FAIL (skipped, will retry on re-run) {str(e)[:50]}", flush=True); continue
        try:
            price = int(float(variants[0].get("price")))
        except (TypeError, ValueError):
            price = None
        cat = (attrs.pop("category", []) or [None])[0]
        # gender: trust the store's own tags/title first (high precision), VLM as fallback
        store_gender = gender_from_store(p)
        gender = store_gender or (attrs.pop("gender", []) or [None])[0]
        attrs.pop("gender", None)
        results.append({
            "id": p.get("id"), "brand": brand, "title": p.get("title"),
            "price": price, "band": band(price), "image": tag_img, "link": link,
            "gender": gender, "gender_src": "store" if store_gender else "vlm",
            "category": cat, **attrs,
        })
        n += 1
        if n % 10 == 0:
            el = time.time() - t0
            print(f"  ...{n} tagged  ({el:.0f}s, {el/n:.1f}s/item, {fails} fails)", flush=True)
            json.dump(results, open(tagged_path, "w", encoding="utf-8"), ensure_ascii=False)  # checkpoint

    json.dump(results, open(tagged_path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\ntagged {n} new ({len(results)} total) -> {tagged_path}")
    validate_summary(results)
    print(f"\nNOT merged. Review the file, then run:  python merge_catalog.py {brand}")

if __name__ == "__main__":
    main()
