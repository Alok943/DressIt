from typing import Annotated
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode
from pathlib import Path

class Settings(BaseSettings):
    catalog_path: str = str(Path(__file__).parents[2] / "frontend/public/catalog.json")
    reactions_path: str = str(Path(__file__).parents[1] / "reactions.jsonl")

    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    reranker_enabled: bool = False  # flip to True once GROQ_API_KEY is set

    # NoDecode: take the raw env string (don't JSON-decode), so Render/host env UIs
    # can set CORS_ORIGINS as a plain comma-separated list, not a quoted JSON array.
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173", "http://localhost:5174",
        "http://localhost:5175", "http://localhost:5176",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):  # tolerate a JSON array too
                import json
                return json.loads(s)
            return [o.strip() for o in s.split(",") if o.strip()]
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
