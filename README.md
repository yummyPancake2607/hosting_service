# CRISPERHOST

Self-hosted PaaS MVP for university infrastructure.

CRISPERHOST provides a platform where students can log in, submit projects, configure build/run commands, simulate deployments, and monitor logs from a terminal-style dashboard.

## Project Overview

The repository contains:

- A React + Vite frontend with a cyberpunk terminal-style dashboard.
- A FastAPI backend with SQLAlchemy + SQLite integration.
- Seeded auth user for immediate login (`testing` / `123`).
- Simulated deployment lifecycle and logs for MVP workflows.

## Architecture Diagram (ASCII)

```text
+----------------------+        HTTP/JSON        +------------------------+
|      Frontend        | ----------------------> |       FastAPI API      |
| React + Vite + TWCSS |                         |  auth + deployments    |
+----------+-----------+                         +-----------+------------+
           |                                                   |
           |                                                   |
           |                         SQLAlchemy ORM            |
           +----------------------------------------------->  |
                                                               v
                                                    +----------------------+
                                                    |       SQLite         |
                                                    | backend/crisperhost  |
                                                    | .db users/deploy/log |
                                                    +----------------------+
```

## Tech Stack

### Frontend

- React
- Vite
- TailwindCSS
- React Router
- Axios

### Backend

- FastAPI (Python 3.10.12)
- SQLAlchemy ORM
- SQLite

## Runtime Versions (Required)

- Python: `3.10.12`
- pip: `22.0.2`
- Node.js: `v12.22.9`
- npm: `8.5.1`

## Repository Structure

```text
crisperhost/
├── frontend/
├── backend/
├── docs/
├── .env.example
└── README.md
```

## Local Setup

## 1. Clone and Enter Repository

```bash
git clone <your-repo-url> crisperhost
cd crisperhost
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` as needed:

```env
DATABASE_URL=sqlite:///./backend/crisperhost.db
SECRET_KEY=change-me-in-production
PUBLIC_DEPLOYMENT_BASE_URL=http://localhost:5173
```

## 3. Database Setup

SQLite requires no separate database service.

- Database file is created automatically at `backend/crisperhost.db` on backend startup.
- If you want a fresh database, stop backend and remove that file.

## Backend Setup

```bash
cd backend
python3.10 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip==22.0.2
pip install -r requirements.txt
```

Verify interpreter before installing packages:

```bash
python --version
pip --version
```

Expected: Python `3.10.12` from `backend/.venv`.

Run backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL:

- `http://localhost:8000`

Health endpoint:

- `GET /health`

## Frontend Setup

Open a new terminal:

```bash
cd frontend
cp .env.example .env
node --version   # must be v12.22.9
npm --version    # must be 8.5.1
npm install
npm run dev
```

Frontend URL:

- `http://localhost:5173`

Default frontend mode uses real backend API (`VITE_USE_MOCK_API=false`) so Deploy executes actual commands.

Frontend `.env` example:

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_USE_MOCK_API=false
VITE_PUBLIC_DEPLOYMENT_BASE_URL=http://localhost:5173
```

Public deployment URLs:

- Each deployment now gets a localhost route, for example `http://localhost:5173/my-project`.
- Opening that path serves a public deployment endpoint page that embeds the real runtime URL when deployment succeeds.

Real deployment execution flow:

- Upload a ZIP from New Deployment page.
- Frontend calls `POST /deploy/detect` to auto-fill deployment type and commands:
   - React: `npm run build` + empty run command (static runtime fallback)
   - Node: `npm install` + `npm run start` (or `npm run dev` if no start script)
   - Python: `pip install -r requirements.txt`
   - Static: no build/run command
- Backend auto-detects dependency manifests and runs install (`npm ci`/`npm install`/`yarn`/`pnpm` or Python install) before build.
- Backend runs `build_command` inside extracted source.
- Backend attempts to start runtime with `run_command`.
- If `run_command` fails but static output exists (`dist`, `build`, `out`, `public`, or source root with `index.html`), backend serves static output with an internal runtime server.

## Run Instructions

1. No database service is required (SQLite is embedded).
2. Start backend from `backend` with Uvicorn.
3. Start frontend from `frontend` with Vite.
4. Open frontend URL and log in:
   - Username: `testing`
   - Password: `123`

## Available Backend Endpoints

- `POST /login`
- `GET /health`
- `GET /deployments`
- `POST /deploy`
- `POST /deploy/detect`
- `POST /deploy/upload`
- `GET /deployment/{id}`
- `GET /deployment/slug/{slug}`
- `GET /logs/{id}`

## Notes

- This is an MVP starter intended for self-hosted university environments.
- Deployments from `POST /deploy/upload` perform real archive extraction, command execution, and runtime serving.
