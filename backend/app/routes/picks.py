from fastapi import APIRouter
from ..catalog import get_catalog
from ..filter import rank_picks
from ..reranker import rerank, _rule_why
from ..schemas import PicksRequest, PicksResponse, PickedProduct

router = APIRouter()


@router.post("/picks", response_model=PicksResponse)
def get_picks(body: PicksRequest):
    catalog = get_catalog()
    answers = {k: v.model_dump() for k, v in body.answers.items()}

    # score + dedupe (same logic as frontend filter.js)
    picks, count = rank_picks(catalog, answers, n=20)  # fetch 20 for re-ranker headroom

    # optional LLM re-rank (gated by RERANKER_ENABLED)
    reranked_picks = rerank(picks, answers, n=5)
    reranked = reranked_picks is not None
    final = reranked_picks if reranked else picks[:5]

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
