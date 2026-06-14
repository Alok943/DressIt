from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    catalog_path: str = str(Path(__file__).parents[2] / "frontend/public/catalog.json")
    reactions_path: str = str(Path(__file__).parents[1] / "reactions.jsonl")

    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    reranker_enabled: bool = False  # flip to True once GROQ_API_KEY is set

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
