import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

_BACKEND_DIR = Path(__file__).resolve().parent
_BACKEND_ENV_PATH = _BACKEND_DIR / ".env"

# Prefer backend-local environment values so DB config is stable regardless of cwd.
load_dotenv(dotenv_path=_BACKEND_ENV_PATH, override=True)
load_dotenv(override=False)


def _default_sqlite_url() -> str:
    return f"sqlite:///{(_BACKEND_DIR / 'crisperhost.db').as_posix()}"


def _resolve_sqlite_url(url: str) -> str:
    if url.startswith("sqlite:///./"):
        relative_part = url[len("sqlite:///./") :]
        return f"sqlite:///{(_BACKEND_DIR / relative_part).as_posix()}"
    return url

DATABASE_URL = os.getenv(
    "DATABASE_URL", _default_sqlite_url()
)
DATABASE_URL = _resolve_sqlite_url(DATABASE_URL)

engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
