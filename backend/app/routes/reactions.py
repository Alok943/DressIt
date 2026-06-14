import json
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter
from ..schemas import ReactRequest, ReactResponse
from ..config import settings

router = APIRouter()


@router.post("/react", response_model=ReactResponse)
def post_reaction(body: ReactRequest):
    if body.reaction not in ("up", "down"):
        return ReactResponse(ok=False)

    row = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "product_link": body.product_link,
        "reaction": body.reaction,
        "session_id": body.session_id,
        "answers": {k: v.model_dump() for k, v in body.answers.items()} if body.answers else {},
    }

    path = Path(settings.reactions_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

    return ReactResponse(ok=True)
