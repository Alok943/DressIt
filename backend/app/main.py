from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .catalog import load_catalog
from .config import settings
from .routes import picks, reactions


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_catalog()
    yield


app = FastAPI(title="Dressit API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(picks.router, prefix="/api")
app.include_router(reactions.router, prefix="/api")


@app.get("/health")
def health():
    from .catalog import get_catalog
    return {"ok": True, "catalog_size": len(get_catalog())}
