# SQLite Setup for CRISPERHOST (Legacy Filename)

CRISPERHOST now defaults to SQLite for local development.

## Recommended Setup (SQLite)

1. No database server installation is required.
2. Ensure `DATABASE_URL` points to SQLite, for example:

```env
DATABASE_URL=sqlite:///./backend/crisperhost.db
```

3. Start backend normally; tables are created automatically.
4. To reset data, stop backend and delete `backend/crisperhost.db`.

## Legacy PostgreSQL Instructions (Optional)

The sections below are retained for users who still want PostgreSQL.

## Installation

### Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Linux (Fedora / RHEL)

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Linux (Arch Linux)

```bash
sudo pacman -Syu --needed postgresql
sudo -iu postgres initdb -D /var/lib/postgres/data
sudo systemctl enable --now postgresql
```

Run `initdb` only once for the initial database cluster setup.

### Windows

1. Download PostgreSQL installer from the official PostgreSQL website.
2. Run the installer and include:
   - PostgreSQL Server
   - Command Line Tools
   - pgAdmin (optional)
3. Keep the service enabled during installation.
4. Open SQL Shell (psql) after installation.

Alternative with winget:

```powershell
winget install -e --id PostgreSQL.PostgreSQL
```

### macOS

```bash
brew update
brew install postgresql@16
brew services start postgresql@16
```

## Start Database Service

### Linux

```bash
sudo systemctl enable --now postgresql
sudo systemctl status postgresql
```

Arch Linux psql shell access:

```bash
sudo -iu postgres psql
```

### Windows

Start the service from Services app (`services.msc`) or PowerShell:

```powershell
Get-Service *postgres*
Start-Service postgresql-x64-16
```

### macOS

```bash
brew services start postgresql@16
brew services list
```

## Create Database

Open psql as a superuser and run:

```sql
CREATE DATABASE crisperhost;
```

## Create User

```sql
CREATE USER crisperuser WITH PASSWORD 'crisperpass';
GRANT ALL PRIVILEGES ON DATABASE crisperhost TO crisperuser;
```

Recommended privilege alignment (prevents `permission denied for table users`):

```sql
ALTER DATABASE crisperhost OWNER TO crisperuser;
ALTER SCHEMA public OWNER TO crisperuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crisperuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crisperuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crisperuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crisperuser;
```

## Table Schema (Full SQL)

Connect to the database first:

```sql
\c crisperhost
```

Create all required tables:

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

## Insert Default User

Use a bcrypt hash generated for password `123`.

```sql
INSERT INTO users (username, password_hash)
VALUES ('testing', '$2b$12$yA8dA5O8URsYWfQv6Qk6geQ3nMw6lQcMkp6V6dR1zU0vQxB3zq4J.');
```

If you use the backend startup seeder, this insert is created automatically when missing.

## Database Connection String

Use this value in environment variables:

```text
postgresql://crisperuser:crisperpass@localhost/crisperhost
```

How backend connects:

1. Backend reads `DATABASE_URL` from environment variables.
2. SQLAlchemy creates an engine using that connection string.
3. FastAPI startup creates tables and seeds the default user if needed.
4. API routes use SQLAlchemy sessions from the shared session factory.
