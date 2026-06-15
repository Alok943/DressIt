"""
Optional LLM re-rank: given the top-N scored products + the user's answer labels,
ask Groq to pick the best 5 and write a 1-line match reason for each.
Gated by RERANKER_ENABLED. Falls back silently on any error.
"""

import json
import urllib.request
import urllib.error
from .config import settings


def _answer_summary(answers: dict) -> str:
    parts = [f"{k}: {v['label']}" for k, v in answers.items()]
    return ", ".join(parts)


# human-readable names for canonical schema values used in the "why" line
_CATEGORY_NAMES = {
    "tshirt": "tee", "polo": "polo", "shirt": "shirt", "jeans": "jeans",
    "trousers": "trousers", "cargo": "cargos", "shorts": "shorts",
    "jacket": "jacket", "sweater": "sweater", "hoodie": "hoodie",
    "sweatshirt": "sweatshirt", "joggers": "joggers", "top": "top",
    "dress": "dress", "coord": "co-ord", "skirt": "skirt",
}
_OCCASION_NAMES = {
    "smart_casual": "smart-casual", "casual": "everyday", "work": "the office",
    "party": "a night out", "street": "street style", "formal": "formal looks",
    "festive": "festive days",
}


def _rule_why(product: dict, answers: dict) -> str:
    """A short, human reason — reads like a stylist note, not a tag dump.

    e.g. "An olive tee with an easy fit — made for everyday."
    """
    color = product.get("color")
    c = (color[0] if isinstance(color, list) else color) if color else None

    cat = product.get("category")
    cat = (cat[0] if isinstance(cat, list) else cat) if cat else None
    cat_name = _CATEGORY_NAMES.get(cat, cat) if cat else "piece"

    fit = product.get("fit")
    f = (fit[0] if isinstance(fit, list) else fit) if fit else None
    fit_phrase = {
        "slim": "a slim cut", "skinny": "a slim cut", "muscle": "a slim cut",
        "regular": "an easy fit", "straight": "an easy fit", "tapered": "an easy fit",
        "relaxed": "a relaxed drape", "oversized": "a relaxed drape", "baggy": "a relaxed drape",
    }.get(f)

    occ = product.get("occasion")
    o = (occ[0] if isinstance(occ, list) else occ) if occ else None
    occ_name = _OCCASION_NAMES.get(o, o.replace("_", " ")) if o else None

    head = f"{c.capitalize()} {cat_name}" if c else f"A {cat_name}"
    if fit_phrase:
        head += f" with {fit_phrase}"
    if occ_name:
        return f"{head} — made for {occ_name}."
    return f"{head}." if head else "Matches your style profile."


def rerank(products: list[dict], answers: dict, n: int = 5) -> list[dict] | None:
    if not settings.reranker_enabled or not settings.groq_api_key:
        return None

    candidates = [
        {"link": p["link"], "title": p["title"], "brand": p["brand"],
         "category": p.get("category"), "color": p.get("color"),
         "fit": p.get("fit"), "occasion": p.get("occasion"),
         "price": p.get("price")}
        for p in products
    ]

    prompt = f"""You are a personal stylist AI. A user answered a style quiz with these preferences:
{_answer_summary(answers)}

Here are {len(candidates)} candidate products:
{json.dumps(candidates, indent=2)}

Pick the best {n} products for this user. For each, write a SHORT 1-sentence reason (max 12 words) explaining why it fits their style. Be specific — mention a concrete attribute (color, fit, occasion).

Respond ONLY with a JSON array, no explanation:
[{{"link": "...", "why": "..."}}, ...]"""

    body = json.dumps({
        "model": settings.groq_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
        "max_tokens": 512,
        "response_format": {"type": "json_object"},
    }).encode()

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = json.loads(resp.read())
        content = raw["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        # model may return {"picks": [...]} or a bare array
        if isinstance(parsed, dict):
            parsed = next((v for v in parsed.values() if isinstance(v, list)), [])
        why_map = {item["link"]: item["why"] for item in parsed if "link" in item and "why" in item}
        # reorder products to match LLM order, preserving all n
        ordered = []
        for item in parsed:
            lnk = item.get("link")
            match = next((p for p in products if p["link"] == lnk), None)
            if match and match not in ordered:
                ordered.append(match)
        # backfill from original list if LLM returned fewer
        for p in products:
            if len(ordered) >= n:
                break
            if p not in ordered:
                ordered.append(p)
        # attach why
        for p in ordered[:n]:
            p["_why"] = why_map.get(p["link"], _rule_why(p, answers))
        return ordered[:n]
    except Exception:
        return None
