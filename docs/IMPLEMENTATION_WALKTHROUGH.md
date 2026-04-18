# CRISPERHOST Implementation Walkthrough

This document explains how the project was implemented end to end, including backend architecture, frontend architecture, deployment flow, URL handling, and the recent UI and deletion fixes.

## 1. Goal and Scope

CRISPERHOST is a self-hosted PaaS MVP where a user can:

- log in
- upload project archives
- detect project type and commands
- run install and build steps
- start a runtime (process or static fallback)
- access deployments through public slug URLs
- view logs and metadata
- delete deployments

The system is intentionally lightweight and uses SQLite for persistence.

## 2. Project Structure

Main folders:

- backend: FastAPI API, SQLAlchemy models, deployment runtime orchestration
- frontend: React + Vite UI with routing and deployment actions
- docs: setup and operational documentation

Key implementation files:

- backend/main.py
- backend/deployments/routes.py
- backend/models.py
- backend/schemas.py
- frontend/src/services/api.js
- frontend/src/pages/LoginPage.jsx
- frontend/src/pages/DashboardPage.jsx
- frontend/src/pages/DeploymentDetailsPage.jsx
- frontend/src/pages/PublicDeploymentPage.jsx
- frontend/src/index.css

## 3. Backend Implementation

### 3.1 Application Startup and Middleware

In backend/main.py:

- environment variables are loaded from backend/.env
- FastAPI lifespan creates tables and seeds a default user
- CORS is configured from ALLOWED_ORIGINS
- auth and deployment routers are mounted
- /health endpoint checks database connectivity

### 3.2 Static Frontend Serving and SPA Fallback

The backend also serves the built frontend from frontend/dist.

A custom SPAStaticFiles class is used so non-file routes (for example /my-deployment-slug) fall back to index.html instead of returning 404.

This is important for:

- direct browser refresh on client routes
- opening deployment slug pages when only backend is running

### 3.3 Data Model

In backend/models.py:

- User
- Deployment
- EnvironmentVariable
- BuildLog

Relationships are defined so deployment env vars and logs are linked, and delete cascades are supported through ORM relationships.

### 3.4 Authentication

In backend/auth/routes.py:

- POST /login validates username and password
- returns access token + username

A default user is seeded for MVP usage.

### 3.5 Deployment Detection and Creation

In backend/deployments/routes.py:

- POST /deploy/detect inspects uploaded zip and infers profile:
  - React
  - Node
  - Python
  - Static
  - Unknown fallback
- suggested build and run commands are generated
- VITE env keys are scanned from source files

Two creation paths are implemented:

- POST /deploy for metadata-only simulation mode
- POST /deploy/upload for real archive upload and execution path

### 3.6 Runtime Execution Pipeline

For uploaded archives:

1. archive is validated and safely extracted
2. install strategy is chosen based on manifest and lockfiles
3. install command runs
4. build command runs
5. run command attempts to start process runtime
6. if run does not produce reachable runtime, static artifact fallback is attempted

All phases append lines into BuildLog and are visible in UI.

### 3.7 Runtime Registry and URL Strategy

An in-memory runtime registry stores running processes and runtime URLs by deployment ID.

Public URL strategy:

- deployment has a stable slug URL, based on project name and deduped
- public URL base is resolved from request context or PUBLIC_DEPLOYMENT_BASE_URL

Runtime URL strategy:

- internal runtime may run on localhost random port
- backend exposes proxy endpoint:
  - /_runtime/{deployment_slug}
  - /_runtime/{deployment_slug}/{resource_path}
- API returns runtime_url using public proxy path, not internal localhost-only port

This design allows external access through the single backend-exposed port.

### 3.8 Deployment Read and Delete Endpoints

Implemented endpoints:

- GET /deployments
- GET /deployment/{id}
- GET /deployment/slug/{slug}
- GET /logs/{deployment_id}
- DELETE /deployment/{deployment_id}

Delete implementation:

- verifies deployment exists
- stops active runtime process for that deployment
- deletes deployment record from DB
- responds with 204 No Content

This was added to replace earlier simulated delete behavior in non-mock mode.

## 4. Frontend Implementation

### 4.1 Routing and Layout

React Router is used for:

- login route
- protected app routes
- dashboard, deployment list, deployment details, logs, settings
- public deployment route by slug

### 4.2 API Client and Environment Resolution

In frontend/src/services/api.js:

- Axios client is configured
- API base URL is resolved dynamically:
  - dev defaults to 127.0.0.1:8000
  - backend-hosted static mode can use same-origin behavior
- public base URL resolution supports mapped/container scenarios
- optional mock API mode is supported for local demo

Real API calls are used for critical operations in non-mock mode, including delete.

### 4.3 Deployment Details Actions

In frontend/src/pages/DeploymentDetailsPage.jsx:

- deployment and logs are loaded
- logs poll periodically
- actions include copy URL, restart, stop, delete
- delete now calls real backend delete API and redirects to list page

### 4.4 Dashboard

In frontend/src/pages/DashboardPage.jsx:

- summary metrics and status counts
- recent deployment cards
- links to deployment detail view

### 4.5 Login Page Knowledge Archive Section

In frontend/src/pages/LoginPage.jsx:

- login UI with boot sequence visual style
- custom archive cards added for:
  - CRIPER_Vision.pdf
  - Lessons-Learned-Container-Deployment-Challenges.pdf
- cards open PDFs in new tab

In frontend/src/index.css:

- themed cyber-terminal style
- custom archive card and link styling
- focus and active states tuned to avoid harsh default white outline effects

## 5. Container and URL Behavior

Target behavior:

- app process listens on backend port 8000
- platform maps external port (for example 3005) to internal 8000

Implementation supports this by:

- serving frontend and API from backend app
- resolving public base URL from request/env
- proxying runtime through backend path under /_runtime/{slug}

## 6. Persistence and Logging

SQLite stores:

- users
- deployments
- environment variables
- build logs

Runtime process metadata is in-memory and tied to backend process lifetime. Build and lifecycle logs are persisted in DB.

## 7. Verification Workflow Used

Typical verification path:

1. start backend on 0.0.0.0:8000
2. call /health
3. create upload deployment from sample zip
4. verify /deployment/{id} and /deployment/slug/{slug}
5. verify slug route and runtime proxy route
6. delete deployment
7. verify GET /deployment/{id} returns 404 and list count decreases

## 8. Known Limitations and Next Steps

Current limitations:

- restart and stop are still simulated in non-mock frontend flow
- runtime registry is in-memory (not persistent across backend restarts)
- runtime workspace cleanup is intentionally conservative to avoid deleting tracked files

Recommended next steps:

- implement real backend restart and stop endpoints
- add background job/state manager for runtime lifecycle
- add auth protection for deployment mutation endpoints
- add integration tests for upload, proxy, and delete flows
- improve runtime cleanup policy with explicit safe workspace boundaries

## 9. Summary

The implementation now supports backend-only operation for API plus static frontend, stable public slug URLs, runtime proxying through backend, real deployment deletion, and improved login-page documentation cards for project vision and lessons learned.
