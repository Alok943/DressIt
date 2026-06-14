"""
Data cleanup: reclassify products that are tagged category=tshirt but are actually
polos (the merchant's own title says "Polo ..."). Snitch's product_type lumped polo
t-shirts under "T-Shirts", so normalize.py mis-categorized ~600 of them.

Rule: title has a standalone "polo" (but NOT "polo neck" = turtleneck) -> category = polo.
Idempotent. Backs up before writing. Run:  python fix_categories.py [--dry]

Pure local data — no API calls.
"""
import json, re, sys, shutil
from pathlib import Path

CATALOG = Path("frontend/public/catalog.json")
DRY = "--dry" in sys.argv

RE_POLO = re.compile(r"\bpolo\b", re.I)
RE_NECK = re.compile(r"polo[\s-]?neck", re.I)  # "polo neck" = turtleneck, leave alone


def is_polo_title(title: str) -> bool:
    return bool(RE_POLO.search(title)) and not RE_NECK.search(title)


def has_cat(category, c: str) -> bool:
    if isinstance(category, list):
        return c in category
    return category == c


def set_cat(category, frm: str, to: str):
    """Replace `frm` with `to`, preserving the original string/list shape."""
    if isinstance(category, list):
        return [to if x == frm else x for x in category]
    return to if category == frm else category


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    fixed = 0
    for p in catalog:
        if has_cat(p.get("category"), "tshirt") and is_polo_title(p.get("title", "")):
            p["category"] = set_cat(p["category"], "tshirt", "polo")
            fixed += 1

    print(f"reclassified tshirt -> polo: {fixed}")
    if DRY:
        print("(dry run — nothing written)")
        return
    if fixed:
        bak = CATALOG.with_suffix(".precat.bak.json")
        shutil.copy(CATALOG, bak)
        CATALOG.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
        print(f"backed up -> {bak.name}; wrote {CATALOG}")
    else:
        print("nothing to fix (already clean)")


if __name__ == "__main__":
    main()
