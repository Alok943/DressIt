from fastapi import APIRouter
from ..catalog import get_catalog
from ..filter import rank_picks
from ..reranker import rerank, _rule_why
from ..schemas import PicksRequest, PicksResponse, PickedProduct

router = APIRouter()

# Return the full match set, not a hard 5. The frontend reveals these a batch at a
# time ("Show more"), so this is just an upper bound on payload size, not what's
# rendered at once. Keep in sync with MAX_PICKS in frontend/src/App.jsx.
MAX_PICKS = 300


@router.post("/picks", response_model=PicksResponse)
def get_picks(body: PicksRequest):
    catalog = get_catalog()
    answers = {k: v.model_dump() for k, v in body.answers.items()}

    # score + dedupe (same logic as frontend filter.js)
    picks, count = rank_picks(catalog, answers, n=MAX_PICKS)

    # optional LLM re-rank (gated by RERANKER_ENABLED) — advisory, still capped to 5 when on
    reranked_picks = rerank(picks, answers, n=5)
    reranked = reranked_picks is not None
    final = reranked_picks if reranked else picks

    mapped = [
        PickedProduct(
            id=p.get("link", ""),
            title=p.get("title", ""),
            brand=p.get("brand", ""),
            price="₹" + str(p.get("price", "")),
            image=p.get("image", ""),
            link=p.get("link", ""),
            why=p.get("_why") or _rule_why(p, answers),
        )
        for p in final
    ]

    return PicksResponse(picks=mapped, count=count, reranked=reranked)
