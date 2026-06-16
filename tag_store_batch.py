"""
Batch tagger — same job as tag_store.py, but via Gemini's Batch API (~50% cheaper,
async). Tags a whole store in a handful of background jobs instead of one call per
product. Writes ONLY to data/tagged_<brand>.json (review, then merge_catalog.py) —
identical safety model to tag_store.py.

Run (costs Gemini calls — USER runs this):
  python tag_store_batch.py www.bonkerscorner.com bonkers --from-raw --streetwear
  python tag_store_batch.py www.bonkerscorner.com bonkers --limit 20 --chunk 20   # smoke test first!

Flags:
  --from-raw     tag from data/raw_<brand>.json instead of pulling the live feed
  --streetwear   nudge ambiguous/roomy cuts toward oversized (streetwear labels)
  --limit N      cap NEW products this run (default: all untagged)
  --chunk N      requests per batch job (default 100; keep small so inline payload
                 stays well under the request-size limit — base64 images are large)

NOTE: the per-item tag_store.py is simpler and already works; batch mainly saves
cost at scale. SMOKE-TEST with --limit 20 --chunk 20 before a full run, and paste
any API error — batch response field names can shift between API versions.
"""
import json, sys, io, os, ssl, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)

from tagger import PROMPT, STREETWEAR_HINT, ALLOWED, MODEL, KEY, _fetch_image_b64
from tag_store import band, gender_from_store, validate_summary, pull_all

CTX = ssl._create_unverified_context()
BASE = "https://generativelanguage.googleapis.com/v1beta"


def _build_request(title, b64, mime, style_hint, key):
    """One inline batch request, keyed so we can map the response back to the product."""
    return {
        "request": {
            "contents": [{"role": "user", "parts": [
                {"text": PROMPT + style_hint + f"\n\nTitle: {title}"},
                {"inline_data": {"mime_type": mime, "data": b64}},
            ]}],
            "generation_config": {"temperature": 0, "response_mime_type": "application/json"},
        },
        "metadata": {"key": key},
    }


def _post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
        return json.load(r)


def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url), timeout=120, context=CTX) as r:
        return json.load(r)


def submit_chunk(reqs, display_name):
    """Create one batch job from inline requests; return its resource name (batches/...)."""
    url = f"{BASE}/models/{MODEL}:batchGenerateContent?key={KEY}"
    body = {"batch": {"display_name": display_name,
                      "input_config": {"requests": {"requests": reqs}}}}
    resp = _post(url, body)
    name = resp.get("name") or resp.get("batch", {}).get("name")
    if not name:
        raise RuntimeError(f"no batch name in create response: {json.dumps(resp)[:300]}")
    return name


def _state_of(obj):
    return (obj.get("metadata", {}) or {}).get("state") or obj.get("state") or ""


def _responses_of(obj):
    # defensive: the inline outputs have lived under a few shapes across versions
    for path in (("response", "inlinedResponses"), ("response", "inlined_responses")):
        cur = obj
        for k in path:
            cur = cur.get(k, {}) if isinstance(cur, dict) else {}
        if isinstance(cur, list):
            return cur
    return []


def poll(name, every=10, timeout=3600):
    url = f"{BASE}/{name}?key={KEY}"
    t0 = time.time()
    while True:
        obj = _get(url)
        state = _state_of(obj)
        if obj.get("done") or "SUCCEEDED" in state:
            return _responses_of(obj)
        if "FAILED" in state or "CANCELLED" in state or "EXPIRED" in state:
            raise RuntimeError(f"batch {name} ended in {state}: {json.dumps(obj)[:300]}")
        if time.time() - t0 > timeout:
            raise TimeoutError(f"batch {name} still {state or 'PENDING'} after {timeout}s")
        time.sleep(every)


def parse_attrs(text):
    """Same vocab-clamp as tagger.tag_product."""
    out = json.loads(text)
    clean = {}
    for d, vals in ALLOWED.items():
        got = out.get(d, [])
        if isinstance(got, str):
            got = [got]
        clean[d] = [v for v in got if v in vals]
    return clean


def main():
    if len(sys.argv) < 3:
        print("usage: python tag_store_batch.py <host> <brand> [--from-raw] [--streetwear] [--limit N] [--chunk N]")
        return
    if not KEY:
        print("Set GEMINI_API_KEY in .env"); return
    host, brand = sys.argv[1], sys.argv[2]
    style_hint = STREETWEAR_HINT if "--streetwear" in sys.argv else ""
    from_raw = "--from-raw" in sys.argv
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 10**9
    chunk = int(sys.argv[sys.argv.index("--chunk") + 1]) if "--chunk" in sys.argv else 100

    tagged_path = f"data/tagged_{brand}.json"
    done = {}
    if os.path.exists(tagged_path):
        done = {x["link"]: x for x in json.load(open(tagged_path, encoding="utf-8")) if x.get("link")}
        print(f"resuming: {len(done)} already tagged")

    if from_raw:
        d = json.load(open(f"data/raw_{brand}.json", encoding="utf-8"))
        prods = d.get("products", d) if isinstance(d, dict) else d
        print(f"loaded {len(prods)} from data/raw_{brand}.json")
    else:
        prods = pull_all(host)
        print(f"pulled {len(prods)} from {host}")

    # build the work list: untagged + available + has image, up to --limit
    work = []
    for p in prods:
        if len(work) >= limit:
            break
        link = f"https://{host}/products/{p.get('handle')}"
        if link in done:
            continue
        if not any(v.get("available") for v in p.get("variants", [])):
            continue
        img = (p.get("images") or [{}])[0].get("src")
        if not img:
            continue
        work.append((p, link, img + ("&" if "?" in img else "?") + "width=512"))
    print(f"{len(work)} to tag this run with {MODEL}{' [streetwear]' if style_hint else ''}, chunk={chunk}\n", flush=True)
    if not work:
        return

    # fetch images concurrently (the slow part), then build keyed requests
    def fetch(item):
        p, link, url = item
        try:
            b64, mime = _fetch_image_b64(url)
            mime = "image/jpeg" if ("jpeg" in mime or "jpg" in mime) else ("image/png" if "png" in mime else "image/webp")
            return (p, link, _build_request(p.get("title", ""), b64, mime, style_hint, link))
        except Exception as e:
            print(f"  img fail {str(e)[:50]} <<{link}", flush=True)
            return None

    prepared = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for r in ex.map(fetch, work):
            if r:
                prepared.append(r)
    print(f"prepared {len(prepared)} requests; submitting batch jobs...", flush=True)

    results = list(done.values())
    chunks = [prepared[i:i + chunk] for i in range(0, len(prepared), chunk)]
    for ci, ck in enumerate(chunks):
        reqs = [r[2] for r in ck]
        name = submit_chunk(reqs, f"{brand}-{ci}")
        print(f"  job {ci+1}/{len(chunks)} submitted ({name}); polling...", flush=True)
        responses = poll(name)
        # map by submission order (inline responses come back in request order)
        got = 0
        for (p, link, _), resp in zip(ck, responses):
            try:
                cand = (resp.get("response", resp).get("candidates") or [])[0]
                text = cand["content"]["parts"][0]["text"]
                attrs = parse_attrs(text)
            except Exception as e:
                print(f"    parse fail {str(e)[:40]} <<{link}", flush=True)
                continue
            try:
                price = int(float(p.get("variants", [{}])[0].get("price")))
            except (TypeError, ValueError):
                price = None
            cat = (attrs.pop("category", []) or [None])[0]
            store_gender = gender_from_store(p)
            gender = store_gender or (attrs.pop("gender", []) or [None])[0]
            attrs.pop("gender", None)
            results.append({
                "id": p.get("id"), "brand": brand, "title": p.get("title"),
                "price": price, "band": band(price),
                "image": (p.get("images") or [{}])[0].get("src"), "link": link,
                "gender": gender, "gender_src": "store" if store_gender else "vlm",
                "category": cat, **attrs,
            })
            got += 1
        json.dump(results, open(tagged_path, "w", encoding="utf-8"), ensure_ascii=False)  # checkpoint per job
        print(f"    job {ci+1} done: {got}/{len(ck)} tagged ({len(results)} total)", flush=True)

    print(f"\ntagged {len(results) - len(done)} new ({len(results)} total) -> {tagged_path}")
    validate_summary(results)
    print(f"\nNOT merged. Review the file, then run:  python merge_catalog.py {brand}")


if __name__ == "__main__":
    main()
