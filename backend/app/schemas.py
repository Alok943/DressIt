from pydantic import BaseModel


class AnswerValue(BaseModel):
    label: str
    values: list[str]


class PicksRequest(BaseModel):
    answers: dict[str, AnswerValue]


class PickedProduct(BaseModel):
    id: str
    title: str
    brand: str
    price: str          # formatted: "₹999"
    image: str
    link: str
    why: str            # 1-line match reason (LLM or rule-based fallback)


class PicksResponse(BaseModel):
    picks: list[PickedProduct]
    count: int          # survivors before ranking (powers the counter)
    reranked: bool      # whether LLM re-rank ran


class ReactRequest(BaseModel):
    product_link: str
    reaction: str       # "up" | "down"
    session_id: str
    answers: dict[str, AnswerValue] = {}


class ReactResponse(BaseModel):
    ok: bool
