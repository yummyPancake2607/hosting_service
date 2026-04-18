# CRISPERHOST Backend Build and PostgreSQL Guide

This guide gives you a complete, file-by-file backend code reference and the exact PostgreSQL setup needed to run CRISPERHOST.

## 1. Runtime Versions (Container Target)

Use these exact versions:

- Python 3.10.12
- pip 22.0.2
- Node v12.22.9
- npm 8.5.1

## 2. PostgreSQL Installation and Service Start

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

### Linux (Fedora/RHEL)

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

### Linux (Arch Linux)

```bash
sudo pacman -Syu --needed postgresql
sudo -iu postgres initdb -D /var/lib/postgres/data
sudo systemctl enable --now postgresql
sudo systemctl status postgresql
```

Run `initdb` only once when setting up the PostgreSQL data directory for the first time.

### macOS

```bash
brew update
brew install postgresql@16
brew services start postgresql@16
brew services list
```

### Windows

1. Install PostgreSQL from the official installer.
2. Ensure the PostgreSQL service is running.
3. Open SQL Shell (psql).

## 3. Create Database and User

Open PostgreSQL shell as a superuser:

```bash
sudo -iu postgres psql
```

Run:

```sql
CREATE DATABASE crisperhost;
CREATE USER crisperuser WITH PASSWORD 'crisperpass';
GRANT ALL PRIVILEGES ON DATABASE crisperhost TO crisperuser;

ALTER DATABASE crisperhost OWNER TO crisperuser;
ALTER SCHEMA public OWNER TO crisperuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crisperuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crisperuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crisperuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crisperuser;
```

Connect into the new database:

```sql
\c crisperhost
```

## 4. Create Tables (Full SQL)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deployments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_name VARCHAR(120) NOT NULL,
    project_type VARCHAR(60) NOT NULL,
    status VARCHAR(30) NOT NULL,
    public_url VARCHAR(255),
    build_command VARCHAR(255),
    run_command VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE environment_variables (
    id SERIAL PRIMARY KEY,
    deployment_id INTEGER NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    key VARCHAR(120) NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE build_logs (
    id SERIAL PRIMARY KEY,
    deployment_id INTEGER NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    log_line TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Optional indexes:

```sql
CREATE INDEX idx_deployments_user_id ON deployments(user_id);
CREATE INDEX idx_build_logs_deployment_id ON build_logs(deployment_id);
```

## 5. Connection String

Use this connection string in your environment:

```text
postgresql://crisperuser:crisperpass@localhost/crisperhost
```

## 6. Environment File

Create a root `.env` file (or copy from `.env.example`) with:

```env
DATABASE_URL=postgresql://crisperuser:crisperpass@localhost/crisperhost
SECRET_KEY=change-me-in-production
PUBLIC_DEPLOYMENT_BASE_URL=http://localhost:5173
```

## 7. Backend Code (File by File)

### backend/requirements.txt

```txt
fastapi==0.110.3
uvicorn==0.30.6
sqlalchemy==2.0.36
psycopg2-binary==2.9.10
python-multipart==0.0.9
passlib[bcrypt]==1.7.4
bcrypt==4.0.1
python-dotenv==1.0.1
pydantic==2.8.2
alembic==1.13.2
```

### backend/database.py

```python
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://crisperuser:crisperpass@localhost/crisperhost"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### backend/models.py

```python
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    deployments = relationship(
        "Deployment", back_populates="user", cascade="all, delete-orphan"
    )


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_name = Column(String(120), nullable=False)
    project_type = Column(String(60), nullable=False)
    status = Column(String(30), nullable=False, default="Building")
    public_url = Column(String(255), nullable=True)
    build_command = Column(String(255), nullable=True)
    run_command = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="deployments")
    env_vars = relationship(
        "EnvironmentVariable", back_populates="deployment", cascade="all, delete-orphan"
    )
    logs = relationship("BuildLog", back_populates="deployment", cascade="all, delete-orphan")


class EnvironmentVariable(Base):
    __tablename__ = "environment_variables"

    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=False)
    key = Column(String(120), nullable=False)
    value = Column(Text, nullable=False)

    deployment = relationship("Deployment", back_populates="env_vars")


class BuildLog(Base):
    __tablename__ = "build_logs"

    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=False)
    log_line = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    deployment = relationship("Deployment", back_populates="logs")
```

### backend/schemas.py

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    username: str


class EnvVarCreate(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    value: str = Field(default="")


class EnvVarResponse(EnvVarCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class BuildLogResponse(BaseModel):
    id: int
    deployment_id: int
    log_line: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class DeploymentCreate(BaseModel):
    project_name: str = Field(min_length=2, max_length=120)
    project_type: str = Field(default="unknown", max_length=60)
    build_command: str = Field(default="npm run build", max_length=255)
    run_command: str = Field(default="npm run start", max_length=255)
    env_vars: list[EnvVarCreate] = Field(default_factory=list)


class DeploymentSummaryResponse(BaseModel):
    id: int
    project_name: str
    project_type: str
    status: str
    public_url: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeploymentDetailResponse(DeploymentSummaryResponse):
    build_command: str | None = None
    run_command: str | None = None
    env_vars: list[EnvVarResponse] = Field(default_factory=list)
    logs: list[BuildLogResponse] = Field(default_factory=list)
```

### backend/utils/security.py

```python
import base64
import hashlib
import hmac
import time

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(username: str, secret_key: str) -> str:
    issued_at = str(int(time.time()))
    payload = f"{username}:{issued_at}"
    signature = hmac.new(
        secret_key.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    token_payload = f"{payload}:{signature}"
    return base64.urlsafe_b64encode(token_payload.encode("utf-8")).decode("utf-8")
```

### backend/utils/bootstrap.py

```python
from sqlalchemy.orm import Session

from models import User
from utils.security import hash_password


DEFAULT_USERNAME = "testing"
DEFAULT_PASSWORD = "123"


def seed_default_user(db: Session) -> None:
    existing_user = db.query(User).filter(User.username == DEFAULT_USERNAME).first()
    if existing_user:
        return

    user = User(
        username=DEFAULT_USERNAME,
        password_hash=hash_password(DEFAULT_PASSWORD),
    )
    db.add(user)
    db.commit()
```

### backend/auth/routes.py

```python
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import LoginRequest, LoginResponse
from utils.security import create_access_token, verify_password

router = APIRouter(tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    secret_key = os.getenv("SECRET_KEY", "crisperhost-dev-secret")
    token = create_access_token(user.username, secret_key)
    return LoginResponse(access_token=token, username=user.username)
```

### backend/deployments/routes.py

```python
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import BuildLog, Deployment, EnvironmentVariable, User
from schemas import (
    BuildLogResponse,
    DeploymentCreate,
    DeploymentDetailResponse,
    DeploymentSummaryResponse,
    EnvVarResponse,
)
from utils.security import hash_password

router = APIRouter(tags=["Deployments"])


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower().strip()).strip("-")
    return cleaned or "project"


def _build_mock_logs(payload: DeploymentCreate) -> list[str]:
    return [
        f"[ingest] Received source archive for {payload.project_name}",
        "[scan] Validating project files",
        f"[build] Executing: {payload.build_command}",
        "[build] Installing dependencies",
        "[build] Build completed successfully",
        f"[run] Executing: {payload.run_command}",
    ]


def _to_summary(item: Deployment) -> DeploymentSummaryResponse:
    return DeploymentSummaryResponse.model_validate(item)


def _to_detail(item: Deployment) -> DeploymentDetailResponse:
    env_rows = [
        EnvVarResponse.model_validate(env)
        for env in sorted(item.env_vars, key=lambda row: row.id)
    ]
    log_rows = [
        BuildLogResponse.model_validate(log)
        for log in sorted(item.logs, key=lambda row: row.timestamp)
    ]

    return DeploymentDetailResponse(
        id=item.id,
        project_name=item.project_name,
        project_type=item.project_type,
        status=item.status,
        public_url=item.public_url,
        created_at=item.created_at,
        build_command=item.build_command,
        run_command=item.run_command,
        env_vars=env_rows,
        logs=log_rows,
    )


def _get_or_create_default_user(db: Session) -> User:
    user = db.query(User).filter(User.username == "testing").first()
    if user:
        return user

    user = User(username="testing", password_hash=hash_password("123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/deployments", response_model=list[DeploymentSummaryResponse])
def list_deployments(db: Session = Depends(get_db)):
    deployments = (
        db.query(Deployment).order_by(Deployment.created_at.desc(), Deployment.id.desc()).all()
    )
    return [_to_summary(item) for item in deployments]


@router.post("/deploy", response_model=DeploymentDetailResponse)
def create_deployment(payload: DeploymentCreate, db: Session = Depends(get_db)):
    owner = _get_or_create_default_user(db)

    deployment = Deployment(
        user_id=owner.id,
        project_name=payload.project_name,
        project_type=payload.project_type,
        status="Building",
        public_url=None,
        build_command=payload.build_command,
        run_command=payload.run_command,
    )
    db.add(deployment)
    db.flush()

    for env in payload.env_vars:
        db.add(
            EnvironmentVariable(
                deployment_id=deployment.id,
                key=env.key,
                value=env.value,
            )
        )

    for line in _build_mock_logs(payload):
        db.add(BuildLog(deployment_id=deployment.id, log_line=line))

    deployment.status = "Running"
    deployment.public_url = (
        f"https://{_slugify(payload.project_name)}-{deployment.id}.crisperhost.local"
    )
    db.add(
        BuildLog(
            deployment_id=deployment.id,
            log_line=f"[ready] Deployment available at {deployment.public_url}",
        )
    )

    db.commit()

    created = (
        db.query(Deployment)
        .options(selectinload(Deployment.env_vars), selectinload(Deployment.logs))
        .filter(Deployment.id == deployment.id)
        .first()
    )
    if not created:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Deployment could not be loaded after creation",
        )

    return _to_detail(created)


@router.get("/deployment/{deployment_id}", response_model=DeploymentDetailResponse)
def get_deployment(deployment_id: int, db: Session = Depends(get_db)):
    deployment = (
        db.query(Deployment)
        .options(selectinload(Deployment.env_vars), selectinload(Deployment.logs))
        .filter(Deployment.id == deployment_id)
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return _to_detail(deployment)


@router.get("/logs/{deployment_id}", response_model=list[BuildLogResponse])
def get_deployment_logs(deployment_id: int, db: Session = Depends(get_db)):
    deployment_exists = db.query(Deployment.id).filter(Deployment.id == deployment_id).first()
    if not deployment_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    logs = (
        db.query(BuildLog)
        .filter(BuildLog.deployment_id == deployment_id)
        .order_by(BuildLog.timestamp.asc(), BuildLog.id.asc())
        .all()
    )
    return [BuildLogResponse.model_validate(item) for item in logs]
```

### backend/main.py

```python
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from auth.routes import router as auth_router
from database import Base, SessionLocal, engine
from deployments.routes import router as deployments_router
from utils.bootstrap import seed_default_user

load_dotenv()


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
```

## 8. Install Dependencies and Run Backend

From project root:

```bash
cd /home/snowowl/hosting
cp .env.example .env
```

Backend install and run:

```bash
cd backend
python3.10 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip==22.0.2
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

If you see a `pydantic-core` / `PyO3` error mentioning Python 3.14, you are in the wrong virtual environment.

Use this exact sequence:

```bash
cd /home/snowowl/hosting/backend
deactivate 2>/dev/null || true
source .venv/bin/activate
python --version
pip --version
pip install -r requirements.txt
```

Expected Python version here is `3.10.12`, not `3.14`.

## 9. Test Backend Endpoints

```bash
curl http://localhost:8000/health
```

```bash
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testing","password":"123"}'
```

```bash
curl http://localhost:8000/deployments
```

```bash
curl -X POST http://localhost:8000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "sample-app",
    "project_type": "React",
    "build_command": "npm run build",
    "run_command": "npm run start",
    "env_vars": [{"key": "NODE_ENV", "value": "production"}]
  }'
```

## 10. Notes

- Default login user is `testing` with password `123`.
- If the user does not exist, backend startup seeds it automatically.
- `POST /deploy/upload` executes real deployments from ZIP archives.
- Backend runs `build_command`, then attempts `run_command` runtime startup.
- If runtime startup fails but static build output exists (`dist`, `build`, `out`, `public`), backend serves that static site as runtime.
- Deployment public URLs are generated in localhost path format, for example `http://localhost:5173/my-project`.
