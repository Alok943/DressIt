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
import json, sys, os, ssl, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
# reconfigure in place — see note in tag_store.py (avoid double-wrapping sys.stdout)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

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


def _http(req, tries=6):
    """Transient-error-tolerant JSON request (Gemini occasionally drops the connection)."""
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            # 4xx are real (bad request/quota) — don't retry, surface the body
            body = e.read().decode("utf-8", "replace")[:400]
            raise RuntimeError(f"HTTP {e.code}: {body}") from None
        except Exception as e:
            last = e
            time.sleep(min(5 * (i + 1), 30))  # 5,10,15,20,25 — ride out longer SSL/network blips
    raise last


def _post(url, body):
    return _http(urllib.request.Request(url, data=json.dumps(body).encode(),
                                        headers={"Content-Type": "application/json"}))


def _get(url):
    return _http(urllib.request.Request(url))


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
    # actual shape: {response|metadata.output}.inlinedResponses.inlinedResponses[]
    for root in (obj.get("response", {}), (obj.get("metadata", {}) or {}).get("output", {})):
        ir = root.get("inlinedResponses") if isinstance(root, dict) else None
        if isinstance(ir, dict):
            ir = ir.get("inlinedResponses")
        if isinstance(ir, list):
            return ir
    return []


def poll(name, every=10, timeout=3600):
    url = f"{BASE}/{name}?key={KEY}"
    t0 = time.time()
    while True:
        try:
            obj = _get(url)
        except Exception as e:
            # the job runs server-side; a flaky poll shouldn't kill it — retry until timeout
            if time.time() - t0 > timeout:
                raise
            print(f"  poll blip, retrying ({str(e)[:50]})", flush=True)
            time.sleep(every); continue
        state = _state_of(obj)
        if obj.get("done") or "SUCCEEDED" in state:
            return obj
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

    # build the work list: untagged + available + has image, up to --limit.
    # Prefer an explicit `link` on the raw product (custom stores like Bewakoof use
    # /p/<slug>, not Shopify's /products/<handle>); fall back to the Shopify shape.
    work = []
    for p in prods:
        if len(work) >= limit:
            break
        link = p.get("link") or f"https://{host}/products/{p.get('handle')}"
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
    failed_chunks = 0
    for ci, ck in enumerate(chunks):
      # a failed job (network/SSL/quota) must NOT abort the whole run — its products
      # simply stay untagged and get picked up on the next resume-safe re-run
      try:
        reqs = [r[2] for r in ck]
        name = submit_chunk(reqs, f"{brand}-{ci}")
        print(f"  job {ci+1}/{len(chunks)} submitted ({name}); polling...", flush=True)
        obj = poll(name)
        responses = _responses_of(obj)
        if not responses:
            # shape didn't match — show the actual structure so we can fix the path
            def shape(o, d=0):
                if isinstance(o, dict):
                    return {k: shape(v, d + 1) for k, v in list(o.items())[:12]} if d < 4 else "...{}"
                if isinstance(o, list):
                    return [shape(o[0], d + 1), f"...x{len(o)}"] if o else []
                return type(o).__name__
            print("  !! no responses parsed — raw batch object shape:", flush=True)
            print(json.dumps(shape(obj), indent=1)[:1800], flush=True)
            print("  --- snippet ---", flush=True)
            print(json.dumps(obj)[:1500], flush=True)
        # map by echoed metadata.key (= product link) — robust to any reordering
        by_key = {}
        for resp in responses:
            key = (resp.get("metadata") or {}).get("key")
            cands = (resp.get("response") or {}).get("candidates") or []
            if not key or not cands:
                continue
            try:
                parts = cands[0]["content"]["parts"]
                text = next(pt["text"] for pt in parts if "text" in pt)
                by_key[key] = parse_attrs(text)
            except Exception:
                pass
        got = 0
        for (p, link, _) in ck:
            attrs = by_key.get(link)
            if attrs is None:
                print(f"    parse fail <<{link}", flush=True)
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
      except Exception as e:
        failed_chunks += 1
        json.dump(results, open(tagged_path, "w", encoding="utf-8"), ensure_ascii=False)  # keep progress
        print(f"    job {ci+1} FAILED ({str(e)[:70]}) — skipping; re-run to pick these up", flush=True)
        time.sleep(5)
        continue

    if failed_chunks:
        print(f"\n{failed_chunks} job(s) failed this run — just re-run the same command to tag the rest.")
    print(f"\ntagged {len(results) - len(done)} new ({len(results)} total) -> {tagged_path}")
    validate_summary(results)
    print(f"\nNOT merged. Review the file, then run:  python merge_catalog.py {brand}")


if __name__ == "__main__":
    main()
