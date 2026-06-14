"""
Merge a reviewed tagged-store file into the live quiz catalog — the SEPARATE, deliberate
step after you've eyeballed data/tagged_<brand>.json (so VLM hallucinations don't auto-ship).

Run:  python merge_catalog.py bonkers           # merge data/tagged_bonkers.json
      python merge_catalog.py bonkers --dry     # show what would change, don't write

- Backs up catalog.json to catalog.bak.json first.
- Backfills gender="men" on any existing entry missing it (current catalog = Snitch+Bear House, all menswear).
- Replaces all entries of <brand> with the tagged set (idempotent / re-runnable).
"""
import json, sys, io, shutil, os
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

CAT = "frontend/public/catalog.json"

def main():
    if len(sys.argv) < 2:
        print("usage: python merge_catalog.py <brand> [--dry]"); return
    brand = sys.argv[1]
    dry = "--dry" in sys.argv
    tagged_path = f"data/tagged_{brand}.json"
    if not os.path.exists(tagged_path):
        print(f"no {tagged_path} — run tag_store.py first"); return

    tagged = json.load(open(tagged_path, encoding="utf-8"))
    catalog = json.load(open(CAT, encoding="utf-8"))

    # backfill gender on legacy menswear entries
    backfilled = 0
    for c in catalog:
        if not c.get("gender"):
            c["gender"] = "men"; backfilled += 1

    before = len(catalog)
    kept = [c for c in catalog if c.get("brand") != brand]
    merged = kept + tagged

    print(f"catalog: {before} -> {len(merged)}  (removed {before-len(kept)} old '{brand}', added {len(tagged)})")
    print(f"backfilled gender=men on {backfilled} legacy entries")
    print(f"gender mix now: {dict(Counter(c.get('gender') for c in merged))}")
    nocat = sum(1 for c in tagged if not c.get('category'))
    if nocat:
        print(f"  WARNING: {nocat} merged rows have no category — consider re-tagging those")

    if dry:
        print("\n--dry: nothing written"); return
    shutil.copy(CAT, "frontend/public/catalog.bak.json")
    json.dump(merged, open(CAT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nwrote {CAT} (backup at catalog.bak.json)")

if __name__ == "__main__":
    main()
