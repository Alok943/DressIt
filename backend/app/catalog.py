import json
from pathlib import Path
from .config import settings

_catalog: list[dict] = []

def load_catalog() -> None:
    global _catalog
    path = Path(settings.catalog_path).resolve()
    with open(path, encoding="utf-8") as f:
        _catalog = json.load(f)

def get_catalog() -> list[dict]:
    return _catalog
