import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from auth.routes import router as auth_router
from database import Base, SessionLocal, engine
from deployments.routes import router as deployments_router
from utils.bootstrap import seed_default_user

_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=True)
load_dotenv(override=False)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_default_user(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="CRISPERHOST API",
    version="0.1.0",
    description="Self-hosted PaaS starter backend",
    lifespan=lifespan,
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
origins = [origin.strip() for origin in allowed_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(deployments_router)


@app.get("/health")
def health_check():
    db = SessionLocal()
    database = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        database = "error"
    finally:
        db.close()

    return {"status": "ok", "database": database}

app.mount(
    "/app",
    StaticFiles(directory="../frontend/dist", html=True),
    name="frontend"
)