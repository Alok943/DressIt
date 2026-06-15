# Python port of frontend/src/filter.js — kept intentionally identical in logic.

import re

# Collapse colour variants of the same product into one pick — keep identical to
# familyKey in filter.js. Snitch links carry a base SKU shared across colours
# (…-4mss4668-03/<variant>/buy); other brands fall back to title minus colour words.
COLOR_WORDS = {
    "black", "white", "grey", "gray", "beige", "cream", "olive", "brown", "khaki",
    "maroon", "mustard", "blue", "navy", "teal", "red", "pink", "orange", "purple",
    "lavender", "yellow", "green", "peach", "multi", "wine", "mauve", "charcoal",
}


def family_key(p: dict) -> str:
    link = p.get("link", "") or ""
    m = re.search(r"-([a-z0-9]+)-\d+/\d+/buy/?$", link, re.I)
    if m:
        return (p.get("brand", "") or "") + ":" + m.group(1).lower()
    t = re.sub(r"[^a-z0-9 ]", " ", (p.get("title", "") or "").lower())
    toks = [w for w in t.split() if w and w not in COLOR_WORDS and not w.isdigit()]
    return (p.get("brand", "") or "") + ":" + " ".join(toks)


QUESTIONS = [
    {"id": "gender",   "dim": "gender"},
    {"id": "category", "dim": "category"},
    {"id": "occasion", "dim": "occasion"},
    {"id": "fit",      "dim": "fit"},
    {"id": "pattern",  "dim": "pattern"},
    {"id": "color",    "dim": "color",   "soft": True},
    {"id": "band",     "dim": "band"},
    {"id": "sleeve",   "dim": "sleeve",  "soft": True},
    {"id": "fabric",   "dim": "fabric",  "soft": True},
]


def matches(product: dict, dim: str, values: list[str]) -> bool:
    if not values:
        return True  # "no preference" / skip card
    pv = product.get(dim, [])
    if not isinstance(pv, list):
        pv = [pv] if pv is not None else []
    return any(v in pv for v in values)


def survivors(catalog: list[dict], answers: dict) -> list[dict]:
    result = []
    for p in catalog:
        ok = True
        for q in QUESTIONS:
            ans = answers.get(q["id"])
            if not ans:
                continue
            if q.get("soft"):
                continue
            if not matches(p, q["dim"], ans["values"]):
                ok = False
                break
        if ok:
            result.append(p)
    return result


def interleave_by_brand(items: list[dict]) -> list[dict]:
    """Round-robin across brands so one big catalog can't dominate the top.
    Keep identical to interleaveByBrand in filter.js."""
    groups: dict[str, list[dict]] = {}
    for p in items:
        groups.setdefault(p.get("brand", "") or "", []).append(p)
    queues = list(groups.values())
    out: list[dict] = []
    added = True
    while added:
        added = False
        for q in queues:
            if q:
                out.append(q.pop(0))
                added = True
    return out


def rank_picks(catalog: list[dict], answers: dict, n: int = 5) -> tuple[list[dict], int]:
    hard = survivors(catalog, answers)
    soft_qs = [q for q in QUESTIONS if q.get("soft") and answers.get(q["id"])]

    scored = []
    for p in hard:
        score = sum(
            1 for q in soft_qs
            if matches(p, q["dim"], answers[q["id"]]["values"])
        )
        scored.append((score, p))
    scored.sort(key=lambda x: -x[0])

    # dedupe colour/size variants of the same product (see family_key)
    seen: set[str] = set()
    uniq: list[dict] = []
    for _, p in scored:
        key = family_key(p)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)

    return interleave_by_brand(uniq)[:n], len(hard)
