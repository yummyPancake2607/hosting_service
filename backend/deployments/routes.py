import io
import json
import os
import queue
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import BuildLog, Deployment, EnvironmentVariable, User
from schemas import (
    BuildLogResponse,
    DeploymentCreate,
    DeploymentDetailResponse,
    DeploymentSummaryResponse,
    EnvVarCreate,
    EnvVarResponse,
)
from utils.security import hash_password

router = APIRouter(tags=["Deployments"])

_RUNTIME_ROOT = Path(__file__).resolve().parents[1] / ".runtime"
_RUNTIME_LOCK = threading.Lock()
_RUNTIME_REGISTRY: dict[int, dict[str, object]] = {}


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower().strip()).strip("-")
    return cleaned or "project"


def _public_url_from_slug(slug: str, base_url: str | None = None) -> str:
    base = (base_url or os.getenv("PUBLIC_DEPLOYMENT_BASE_URL", "http://localhost:5173")).rstrip("/")
    return f"{base}/{slug}"


def _public_base_from_request(request: Request) -> str:
    origin = (request.headers.get("origin") or "").strip()
    if origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:"):
        return origin

    return os.getenv("PUBLIC_DEPLOYMENT_BASE_URL", "http://localhost:5173")


def _extract_slug(public_url: str | None, project_name: str) -> str:
    if public_url:
        sanitized = public_url.rstrip("/")
        if "/" in sanitized:
            return sanitized.rsplit("/", 1)[-1]
    return _slugify(project_name)


def _append_log(db: Session, deployment_id: int, message: str) -> None:
    db.add(BuildLog(deployment_id=deployment_id, log_line=message))


def _ensure_runtime_root() -> Path:
    _RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    return _RUNTIME_ROOT


def _reserve_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _close_log_handle(entry: dict[str, object]) -> None:
    log_handle = entry.get("log_handle")
    if log_handle and hasattr(log_handle, "close"):
        try:
            log_handle.close()
        except Exception:
            pass


def _stop_runtime(deployment_id: int) -> None:
    with _RUNTIME_LOCK:
        existing = _RUNTIME_REGISTRY.pop(deployment_id, None)

    if not existing:
        return

    process = existing.get("process")
    if process and hasattr(process, "poll") and process.poll() is None:
        try:
            process.terminate()
        except Exception:
            pass

    _close_log_handle(existing)


def _register_runtime(
    deployment_id: int,
    url: str,
    process: subprocess.Popen,
    runtime_type: str,
    workspace: Path,
    log_handle,
) -> None:
    _stop_runtime(deployment_id)
    with _RUNTIME_LOCK:
        _RUNTIME_REGISTRY[deployment_id] = {
            "url": url,
            "process": process,
            "type": runtime_type,
            "workspace": str(workspace),
            "log_handle": log_handle,
        }


def _runtime_url_for_deployment(deployment_id: int) -> str | None:
    with _RUNTIME_LOCK:
        entry = _RUNTIME_REGISTRY.get(deployment_id)

    if not entry:
        return None

    process = entry.get("process")
    if process and hasattr(process, "poll") and process.poll() is not None:
        _stop_runtime(deployment_id)
        return None

    url = entry.get("url")
    return str(url) if url else None


def _existing_slugs(db: Session, exclude_id: int | None = None) -> set[str]:
    query = db.query(Deployment)
    if exclude_id is not None:
        query = query.filter(Deployment.id != exclude_id)

    return {
        _extract_slug(item.public_url, item.project_name)
        for item in query.with_entities(Deployment.id, Deployment.project_name, Deployment.public_url)
    }


def _unique_slug(db: Session, project_name: str, exclude_id: int | None = None) -> str:
    base_slug = _slugify(project_name)
    used = _existing_slugs(db, exclude_id=exclude_id)

    candidate = base_slug
    suffix = 2
    while candidate in used:
        candidate = f"{base_slug}-{suffix}"
        suffix += 1

    return candidate


def _to_summary(item: Deployment) -> DeploymentSummaryResponse:
    return DeploymentSummaryResponse(
        id=item.id,
        project_name=item.project_name,
        project_type=item.project_type,
        status=item.status,
        public_url=item.public_url,
        runtime_url=_runtime_url_for_deployment(item.id),
        created_at=item.created_at,
    )


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
        runtime_url=_runtime_url_for_deployment(item.id),
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


def _parse_env_vars_json(env_vars_json: str) -> list[EnvVarCreate]:
    try:
        parsed = json.loads(env_vars_json or "[]")
        if not isinstance(parsed, list):
            raise ValueError("env_vars_json must be a JSON array")

        return [EnvVarCreate.model_validate(item) for item in parsed]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid env_vars_json payload: {exc}",
        ) from exc


def _safe_extract_zip(archive_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    destination_root = destination.resolve()

    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            member_target = (destination / member.filename).resolve()
            if not str(member_target).startswith(str(destination_root)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid archive contents",
                )
        archive.extractall(destination)


def _normalize_source_root(extracted_dir: Path) -> Path:
    entries = [
        entry
        for entry in extracted_dir.iterdir()
        if entry.name not in {"__MACOSX", ".DS_Store"}
    ]
    top_dirs = [entry for entry in entries if entry.is_dir()]
    top_files = [entry for entry in entries if entry.is_file()]

    if len(top_dirs) == 1 and not top_files:
        return top_dirs[0]

    return extracted_dir


def _suggest_project_name(raw_label: str) -> str:
    stem = Path(raw_label or "project").stem
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._")
    return cleaned or "project"


def _split_optional_env_vars(env_keys: set[str]) -> tuple[list[str], list[str]]:
    optional_keys = {
        "VITE_API_BASE_URL",
        "VITE_API_URL",
    }
    optional = sorted(
        [
            key
            for key in env_keys
            if "SUPABASE" in key or key in optional_keys
        ]
    )
    optional_set = set(optional)
    required = sorted([key for key in env_keys if key not in optional_set])
    return required, optional


def _detect_archive_profile(archive_bytes: bytes, archive_filename: str | None = None) -> dict[str, object]:
    try:
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            file_entries = [
                info.filename.replace("\\", "/").strip("/")
                for info in archive.infolist()
                if info.filename and not info.is_dir()
            ]

            lower_entries = [entry.lower() for entry in file_entries]

            top_level = {
                entry.split("/", 1)[0]
                for entry in file_entries
                if entry and not entry.startswith("__MACOSX/")
            }
            if len(top_level) == 1:
                project_name = _suggest_project_name(next(iter(top_level)))
            else:
                project_name = _suggest_project_name(archive_filename or "project")

            package_json_paths = [entry for entry in file_entries if entry.lower().endswith("package.json")]
            has_package_json = bool(package_json_paths)
            has_requirements = any(entry.endswith("requirements.txt") for entry in lower_entries)
            has_pyproject = any(entry.endswith("pyproject.toml") for entry in lower_entries)
            has_python_files = any(entry.endswith(".py") for entry in lower_entries)
            has_index_html = any(entry.endswith("index.html") for entry in lower_entries)

            package_scripts: dict[str, str] = {}
            package_deps: set[str] = set()
            required_env_vars: set[str] = set()
            if package_json_paths:
                try:
                    package_json_path = sorted(
                        package_json_paths,
                        key=lambda entry: (entry.count("/"), len(entry)),
                    )[0]
                    package_data = json.loads(archive.read(package_json_path).decode("utf-8"))
                    scripts = package_data.get("scripts")
                    if isinstance(scripts, dict):
                        package_scripts = {
                            str(key): str(value)
                            for key, value in scripts.items()
                        }

                    for section in ("dependencies", "devDependencies"):
                        deps = package_data.get(section)
                        if isinstance(deps, dict):
                            package_deps.update(str(name).lower() for name in deps.keys())
                except Exception:
                    package_scripts = {}
                    package_deps = set()

            vite_entry_candidates = [
                entry
                for entry in file_entries
                if not entry.startswith("node_modules/")
                and "/node_modules/" not in entry
                and entry.lower().endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".html"))
            ]
            for entry in vite_entry_candidates[:400]:
                try:
                    raw = archive.read(entry)
                except Exception:
                    continue

                if len(raw) > 1_200_000:
                    continue

                try:
                    content = raw.decode("utf-8", errors="ignore")
                except Exception:
                    continue

                for key in re.findall(r"import\.meta\.env\.([A-Z0-9_]+)", content):
                    if key.startswith("VITE_"):
                        required_env_vars.add(key)

    except zipfile.BadZipFile as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source_archive must be a valid .zip file",
        ) from exc

    is_react = has_package_json and (
        "react" in package_deps
        or "react-dom" in package_deps
        or "vite" in package_deps
        or any(entry.endswith((".jsx", ".tsx")) for entry in lower_entries)
        or any(
            entry.endswith("vite.config.js")
            or entry.endswith("vite.config.ts")
            for entry in lower_entries
        )
    )

    required_env_vars, optional_env_vars = _split_optional_env_vars(required_env_vars)

    if has_package_json:
        has_build_script = "build" in package_scripts
        has_start_script = "start" in package_scripts
        has_dev_script = "dev" in package_scripts
        has_preview_script = "preview" in package_scripts

        if is_react:
            build_command = "npm run build" if has_build_script else "npm install"
            if has_build_script:
                run_command = ""
            elif has_preview_script:
                run_command = "npm run preview"
            elif has_dev_script:
                run_command = "npm run dev"
            elif has_start_script:
                run_command = "npm run start"
            else:
                run_command = ""
        else:
            build_command = "npm run build" if has_build_script else "npm install"
            if has_start_script:
                run_command = "npm run start"
            elif has_dev_script:
                run_command = "npm run dev"
            else:
                run_command = ""

        return {
            "project_name": project_name,
            "project_type": "React" if is_react else "Node",
            "build_command": build_command,
            "run_command": run_command,
            "required_env_vars": required_env_vars,
            "optional_env_vars": optional_env_vars,
        }

    if has_requirements or has_pyproject or has_python_files:
        return {
            "project_name": project_name,
            "project_type": "Python",
            "build_command": "pip install -r requirements.txt",
            "run_command": "uvicorn main:app --host 0.0.0.0 --port 8000",
            "required_env_vars": required_env_vars,
            "optional_env_vars": optional_env_vars,
        }

    if has_index_html:
        return {
            "project_name": project_name,
            "project_type": "Static",
            "build_command": "",
            "run_command": "",
            "required_env_vars": required_env_vars,
            "optional_env_vars": optional_env_vars,
        }

    return {
        "project_name": project_name,
        "project_type": "Unknown",
        "build_command": "npm install",
        "run_command": "npm run dev",
        "required_env_vars": required_env_vars,
        "optional_env_vars": optional_env_vars,
    }


def _prepare_workspace(deployment_id: int, slug: str, archive_bytes: bytes) -> tuple[Path, Path]:
    runtime_root = _ensure_runtime_root()
    workspace = runtime_root / f"deployment-{deployment_id}-{slug}"
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)

    archive_path = workspace / "source.zip"
    archive_path.write_bytes(archive_bytes)

    extracted_dir = workspace / "src"
    _safe_extract_zip(archive_path, extracted_dir)
    source_root = _normalize_source_root(extracted_dir)
    return workspace, source_root


def _run_command(
    command: str,
    cwd: Path,
    env: dict[str, str],
    timeout_seconds: int,
    phase: str,
    on_log_line=None,
) -> tuple[bool, list[str]]:
    command_text = command.strip()
    if not command_text:
        return False, [f"[{phase}] ERROR command is empty"]

    lines: list[str] = []

    def _emit(message: str) -> None:
        lines.append(message)
        if on_log_line:
            try:
                on_log_line(message)
            except Exception:
                pass

    _emit(f"[{phase}] $ {command_text}")

    try:
        process = subprocess.Popen(
            command_text,
            shell=True,
            cwd=str(cwd),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
    except Exception as exc:
        _emit(f"[{phase}] ERROR failed to start command: {exc}")
        return False, lines

    output_queue: queue.Queue[str] = queue.Queue()

    def _reader() -> None:
        if process.stdout is None:
            return
        try:
            for raw_line in process.stdout:
                output_queue.put(raw_line)
        finally:
            try:
                process.stdout.close()
            except Exception:
                pass

    reader_thread = threading.Thread(target=_reader, daemon=True)
    reader_thread.start()

    started_at = time.monotonic()
    timed_out = False

    while True:
        try:
            raw_line = output_queue.get(timeout=0.2)
            clean = raw_line.rstrip()
            if clean:
                _emit(f"[{phase}] {clean}")
        except queue.Empty:
            pass

        if process.poll() is not None:
            while True:
                try:
                    raw_line = output_queue.get_nowait()
                except queue.Empty:
                    break
                clean = raw_line.rstrip()
                if clean:
                    _emit(f"[{phase}] {clean}")
            break

        if time.monotonic() - started_at > timeout_seconds:
            timed_out = True
            try:
                process.kill()
            except Exception:
                pass
            break

    reader_thread.join(timeout=1.0)

    if timed_out:
        while True:
            try:
                raw_line = output_queue.get_nowait()
            except queue.Empty:
                break
            clean = raw_line.rstrip()
            if clean:
                _emit(f"[{phase}] {clean}")
        _emit(f"[{phase}] ERROR timed out after {timeout_seconds}s")
        return False, lines

    return_code = process.returncode if process.returncode is not None else process.wait()
    if return_code != 0:
        _emit(f"[{phase}] ERROR exited with code {return_code}")
        return False, lines

    _emit(f"[{phase}] OK")
    return True, lines


def _detect_install_command(source_root: Path) -> tuple[str | None, str]:
    if (source_root / "package.json").exists():
        if (source_root / "pnpm-lock.yaml").exists():
            if shutil.which("pnpm"):
                return "pnpm install --frozen-lockfile", "Node project detected (pnpm lockfile)"
            return "npm install", "Node project detected (pnpm lockfile), pnpm unavailable so using npm"

        if (source_root / "yarn.lock").exists():
            if shutil.which("yarn"):
                return "yarn install --frozen-lockfile", "Node project detected (yarn lockfile)"
            return "npm install", "Node project detected (yarn lockfile), yarn unavailable so using npm"

        if (source_root / "package-lock.json").exists() or (source_root / "npm-shrinkwrap.json").exists():
            return "npm ci", "Node project detected (npm lockfile)"

        return "npm install", "Node project detected (no lockfile)"

    if (source_root / "requirements.txt").exists():
        return f"{sys.executable} -m pip install -r requirements.txt", "Python project detected (requirements.txt)"

    if (source_root / "pyproject.toml").exists():
        if shutil.which("poetry"):
            return "poetry install --no-interaction --no-root", "Python project detected (pyproject.toml)"
        return None, "Python project detected (pyproject.toml), but poetry is unavailable"

    return None, "No dependency manifest found"


def _read_package_scripts(source_root: Path) -> set[str]:
    package_json = source_root / "package.json"
    if not package_json.exists():
        return set()

    try:
        package_data = json.loads(package_json.read_text(encoding="utf-8"))
    except Exception:
        return set()

    scripts = package_data.get("scripts")
    if not isinstance(scripts, dict):
        return set()

    return {str(key).strip() for key in scripts.keys() if str(key).strip()}


def _extract_command_port(command: str) -> int | None:
    match = re.search(r"--port\s+([0-9]{2,5})", command)
    if match:
        return int(match.group(1))

    match = re.search(r"-p\s+([0-9]{2,5})", command)
    if match:
        return int(match.group(1))

    return None


def _is_local_port_open(port: int, timeout_seconds: float = 0.3) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout_seconds):
            return True
    except OSError:
        return False


def _extract_runtime_url_from_log(log_path: Path) -> str | None:
    try:
        text = log_path.read_text(encoding="utf-8")
    except Exception:
        return None

    matches = re.findall(
        r"https?://(?:127\.0\.0\.1|localhost|0\.0\.0\.0):[0-9]{2,5}",
        text,
    )
    if not matches:
        return None

    return matches[-1].replace("0.0.0.0", "localhost")


def _start_process_runtime(
    deployment_id: int,
    workspace: Path,
    source_root: Path,
    run_command: str,
    env: dict[str, str],
) -> tuple[str | None, list[str]]:
    command_text = run_command.strip()
    if not command_text:
        return None, ["[run] ERROR command is empty"]

    command_port = _extract_command_port(command_text)
    runtime_port = command_port or _reserve_port()
    run_env = env.copy()
    run_env.setdefault("PORT", str(runtime_port))

    log_path = workspace / "runtime.log"
    log_handle = log_path.open("a", encoding="utf-8")
    process = subprocess.Popen(
        command_text,
        shell=True,
        cwd=str(source_root),
        env=run_env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
    )

    time.sleep(2.5)
    if process.poll() is not None:
        log_handle.flush()
        failure_lines = []
        try:
            failure_lines = [line.strip() for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()][-40:]
        except Exception:
            failure_lines = []
        log_handle.close()

        output_lines = [f"[run] ERROR exited with code {process.returncode}"]
        output_lines.extend([f"[run] {line}" for line in failure_lines])
        return None, output_lines

    runtime_url = None
    if command_port:
        runtime_url = f"http://localhost:{command_port}"
    else:
        runtime_url = _extract_runtime_url_from_log(log_path)
        if not runtime_url and _is_local_port_open(runtime_port):
            runtime_url = f"http://localhost:{runtime_port}"

    if not runtime_url:
        try:
            process.terminate()
        except Exception:
            pass
        log_handle.close()
        return None, [
            "[run] ERROR process started but runtime port could not be determined",
            "[run] Hint: include --port in run command or leave run command empty to serve build artifacts",
        ]

    _register_runtime(
        deployment_id=deployment_id,
        url=runtime_url,
        process=process,
        runtime_type="process",
        workspace=workspace,
        log_handle=log_handle,
    )
    return runtime_url, [f"[run] Runtime process started at {runtime_url}"]


def _find_artifact_dir(source_root: Path) -> Path | None:
    candidates = [
        source_root / "dist",
        source_root / "build",
        source_root / "out",
        source_root / "public",
    ]

    for candidate in candidates:
        index_file = candidate / "index.html"
        if candidate.is_dir() and index_file.exists():
            return candidate

    if not (source_root / "package.json").exists():
        root_index = source_root / "index.html"
        if root_index.exists():
            return source_root

    return None


def _start_static_runtime(
    deployment_id: int,
    workspace: Path,
    artifact_dir: Path,
) -> tuple[str | None, list[str]]:
    runtime_port = _reserve_port()
    log_path = workspace / "runtime.log"
    log_handle = log_path.open("a", encoding="utf-8")
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "http.server",
            str(runtime_port),
            "--bind",
            "127.0.0.1",
        ],
        cwd=str(artifact_dir),
        stdout=log_handle,
        stderr=subprocess.STDOUT,
    )

    time.sleep(1.0)
    if process.poll() is not None:
        log_handle.flush()
        log_handle.close()
        return None, ["[runtime] ERROR static server failed to start"]

    runtime_url = f"http://localhost:{runtime_port}"
    _register_runtime(
        deployment_id=deployment_id,
        url=runtime_url,
        process=process,
        runtime_type="static",
        workspace=workspace,
        log_handle=log_handle,
    )
    return runtime_url, [f"[runtime] Static artifact server started at {runtime_url}"]


def _load_deployment_or_500(db: Session, deployment_id: int) -> Deployment:
    created = (
        db.query(Deployment)
        .options(selectinload(Deployment.env_vars), selectinload(Deployment.logs))
        .filter(Deployment.id == deployment_id)
        .first()
    )
    if not created:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Deployment could not be loaded",
        )

    return created


@router.get("/deployments", response_model=list[DeploymentSummaryResponse])
def list_deployments(db: Session = Depends(get_db)):
    deployments = (
        db.query(Deployment).order_by(Deployment.created_at.desc(), Deployment.id.desc()).all()
    )
    return [_to_summary(item) for item in deployments]


@router.post("/deploy/detect")
async def detect_deployment_profile(source_archive: UploadFile = File(...)):
    if not source_archive.filename or not source_archive.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source_archive must be a .zip file",
        )

    archive_bytes = await source_archive.read()
    if not archive_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded archive is empty",
        )

    return _detect_archive_profile(archive_bytes, source_archive.filename)


@router.post("/deploy", response_model=DeploymentDetailResponse)
def create_deployment(
    payload: DeploymentCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    owner = _get_or_create_default_user(db)
    slug = _unique_slug(db, payload.project_name)
    public_base = _public_base_from_request(request)

    deployment = Deployment(
        user_id=owner.id,
        project_name=payload.project_name,
        project_type=payload.project_type,
        status="Building",
        public_url=_public_url_from_slug(slug, public_base),
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

    _append_log(db, deployment.id, f"[ingest] Deployment request accepted for {payload.project_name}")
    _append_log(db, deployment.id, f"[build] {payload.build_command}")
    _append_log(db, deployment.id, f"[run] {payload.run_command}")
    _append_log(db, deployment.id, "[runtime] No archive uploaded, using simulation mode")

    deployment.status = "Running"
    _append_log(db, deployment.id, f"[ready] Deployment available at {deployment.public_url}")
    db.commit()

    return _to_detail(_load_deployment_or_500(db, deployment.id))


@router.post("/deploy/upload", response_model=DeploymentDetailResponse)
async def create_deployment_from_upload(
    request: Request,
    project_name: str = Form(...),
    project_type: str = Form("unknown"),
    build_command: str = Form("npm run build"),
    run_command: str = Form(""),
    env_vars_json: str = Form("[]"),
    source_archive: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not source_archive.filename or not source_archive.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source_archive must be a .zip file",
        )

    parsed_env_vars = _parse_env_vars_json(env_vars_json)

    archive_bytes = await source_archive.read()
    if not archive_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded archive is empty",
        )

    detected = _detect_archive_profile(archive_bytes, source_archive.filename)

    resolved_project_name = (project_name or "").strip() or detected["project_name"]

    requested_project_type = (project_type or "").strip()
    resolved_project_type = (
        detected["project_type"]
        if not requested_project_type or requested_project_type.lower() == "unknown"
        else requested_project_type
    )

    incoming_build = (build_command or "").strip()
    incoming_run = (run_command or "").strip()

    if detected["project_type"] == "Static":
        resolved_build_command = ""
        resolved_run_command = ""
    else:
        resolved_build_command = incoming_build or detected["build_command"]
        resolved_run_command = incoming_run or detected["run_command"]

        if (
            detected["project_type"] == "React"
            and incoming_build == "npm install"
            and incoming_run == "npm run dev"
        ):
            resolved_build_command = detected["build_command"]
            resolved_run_command = detected["run_command"]

        if detected["project_type"] == "Python":
            if incoming_build in {"", "npm install", "npm run build"}:
                resolved_build_command = detected["build_command"]
            if incoming_run in {"", "npm run dev", "npm run start"}:
                resolved_run_command = detected["run_command"]

    payload = DeploymentCreate(
        project_name=resolved_project_name,
        project_type=resolved_project_type,
        build_command=resolved_build_command,
        run_command=resolved_run_command,
        env_vars=parsed_env_vars,
    )

    detected_required_env_vars = [
        str(item).strip()
        for item in detected.get("required_env_vars", [])
        if str(item).strip().startswith("VITE_")
    ]
    detected_optional_env_vars = [
        str(item).strip()
        for item in detected.get("optional_env_vars", [])
        if str(item).strip().startswith("VITE_")
    ]
    payload_env_keys = {env.key.strip() for env in payload.env_vars if env.key.strip()}
    missing_required_env_vars = [
        key
        for key in detected_required_env_vars
        if key not in payload_env_keys and not os.getenv(key)
    ]
    missing_optional_env_vars = [
        key
        for key in detected_optional_env_vars
        if key not in payload_env_keys and not os.getenv(key)
    ]

    optional_env_fallbacks = {
        "VITE_SUPABASE_URL": "https://placeholder.supabase.local",
        "VITE_SUPABASE_ANON_KEY": "placeholder-anon-key",
    }
    applied_optional_fallbacks = {
        key: value
        for key, value in optional_env_fallbacks.items()
        if key in missing_optional_env_vars
    }

    owner = _get_or_create_default_user(db)
    slug = _unique_slug(db, payload.project_name)
    public_base = _public_base_from_request(request)

    deployment = Deployment(
        user_id=owner.id,
        project_name=payload.project_name,
        project_type=payload.project_type,
        status="Building",
        public_url=_public_url_from_slug(slug, public_base),
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

    def _append_log_realtime(message: str) -> None:
        _append_log(db, deployment.id, message)
        db.commit()

    _append_log(
        db,
        deployment.id,
        f"[ingest] Archive received: {source_archive.filename}",
    )
    _append_log(
        db,
        deployment.id,
        (
            "[ingest] Detected profile "
            f"{detected['project_type']} (build='{payload.build_command or 'none'}', run='{payload.run_command or 'none'}')"
        ),
    )
    if missing_required_env_vars:
        _append_log(
            db,
            deployment.id,
            "[config] WARNING missing environment variables: " + ", ".join(sorted(missing_required_env_vars)),
        )
        _append_log(
            db,
            deployment.id,
            "[config] Add missing keys in deployment environment variables before running this app",
        )
    if missing_optional_env_vars:
        _append_log(
            db,
            deployment.id,
            "[config] INFO optional environment variables not provided: " + ", ".join(sorted(missing_optional_env_vars)),
        )
    if applied_optional_fallbacks:
        _append_log(
            db,
            deployment.id,
            "[config] INFO auto-applied compatibility defaults for: " + ", ".join(sorted(applied_optional_fallbacks.keys())),
        )

    try:
        workspace, source_root = _prepare_workspace(deployment.id, slug, archive_bytes)
    except HTTPException:
        raise
    except Exception as exc:
        deployment.status = "Failed"
        _append_log(db, deployment.id, f"[ingest] ERROR archive extraction failed: {exc}")
        db.commit()
        return _to_detail(_load_deployment_or_500(db, deployment.id))

    _append_log(db, deployment.id, f"[ingest] Source extracted to {source_root}")
    db.commit()

    runtime_env = os.environ.copy()
    runtime_env["PYTHONUNBUFFERED"] = "1"
    runtime_env.setdefault("npm_config_engine_strict", "false")
    runtime_env.setdefault("NPM_CONFIG_ENGINE_STRICT", "false")
    for env in payload.env_vars:
        runtime_env[env.key] = env.value
    for key, value in applied_optional_fallbacks.items():
        runtime_env.setdefault(key, value)

    install_command, install_strategy = _detect_install_command(source_root)
    _append_log(db, deployment.id, f"[install] {install_strategy}")

    install_ok = True
    if install_command:
        install_ok, _ = _run_command(
            command=install_command,
            cwd=source_root,
            env=runtime_env,
            timeout_seconds=1200,
            phase="install",
            on_log_line=_append_log_realtime,
        )

        if not install_ok and install_command == "npm ci":
            _append_log_realtime("[install] npm ci failed, retrying with npm install")
            install_ok, _ = _run_command(
                command="npm install",
                cwd=source_root,
                env=runtime_env,
                timeout_seconds=1200,
                phase="install",
                on_log_line=_append_log_realtime,
            )
    else:
        _append_log(db, deployment.id, "[install] SKIPPED")
        db.commit()

    if payload.build_command.strip():
        build_ok, _ = _run_command(
            command=payload.build_command,
            cwd=source_root,
            env=runtime_env,
            timeout_seconds=1200,
            phase="build",
            on_log_line=_append_log_realtime,
        )
    else:
        build_ok, _ = True, ["[build] SKIPPED"]
        _append_log(db, deployment.id, "[build] SKIPPED")
        db.commit()

    if not install_ok:
        _append_log(
            db,
            deployment.id,
            "[run] Dependency installation failed; attempting runtime start anyway",
        )

    if not build_ok:
        _append_log(
            db,
            deployment.id,
            "[run] Build failed; attempting runtime start anyway",
        )

    runtime_url = None

    if payload.run_command.strip():
        run_command_to_execute = payload.run_command
        package_scripts = _read_package_scripts(source_root)
        npm_script_match = re.fullmatch(r"npm\s+run\s+([A-Za-z0-9:_-]+)", payload.run_command.strip())
        if npm_script_match:
            script_name = npm_script_match.group(1)
            if script_name not in package_scripts:
                _append_log(
                    db,
                    deployment.id,
                    f"[run] WARNING script '{script_name}' not found in package.json; skipping process runtime",
                )
                run_command_to_execute = ""

        if run_command_to_execute.strip():
            runtime_url, run_logs = _start_process_runtime(
                deployment_id=deployment.id,
                workspace=workspace,
                source_root=source_root,
                run_command=run_command_to_execute,
                env=runtime_env,
            )
        else:
            runtime_url, run_logs = None, ["[run] SKIPPED"]
    else:
        runtime_url, run_logs = None, ["[run] SKIPPED"]

    for line in run_logs:
        _append_log(db, deployment.id, line)
        db.commit()

    if not runtime_url:
        artifact_dir = _find_artifact_dir(source_root)
        if artifact_dir:
            if not build_ok:
                _append_log(
                    db,
                    deployment.id,
                    f"[runtime] Build failed, attempting static fallback from {artifact_dir}",
                )
            index_file = artifact_dir / "index.html"
            try:
                if index_file.exists() and index_file.stat().st_size == 0:
                    _append_log(
                        db,
                        deployment.id,
                        f"[runtime] WARNING {index_file} is empty; rendered page will be blank",
                    )
            except OSError:
                pass
            static_url, static_logs = _start_static_runtime(
                deployment_id=deployment.id,
                workspace=workspace,
                artifact_dir=artifact_dir,
            )
            for line in static_logs:
                _append_log(db, deployment.id, line)
                db.commit()
            runtime_url = static_url

    if runtime_url:
        deployment.status = "Running"
        _append_log(db, deployment.id, f"[ready] Deployment available at {deployment.public_url}")
        _append_log(db, deployment.id, f"[ready] Runtime endpoint {runtime_url}")
    else:
        deployment.status = "Failed"
        _append_log(
            db,
            deployment.id,
            "[ready] ERROR deployment runtime was not started",
        )

    db.commit()
    return _to_detail(_load_deployment_or_500(db, deployment.id))


@router.get("/deployment/slug/{deployment_slug}", response_model=DeploymentDetailResponse)
def get_deployment_by_slug(deployment_slug: str, db: Session = Depends(get_db)):
    target_slug = _slugify(deployment_slug)
    deployments = (
        db.query(Deployment)
        .options(selectinload(Deployment.env_vars), selectinload(Deployment.logs))
        .order_by(Deployment.created_at.desc(), Deployment.id.desc())
        .all()
    )

    for deployment in deployments:
        if _extract_slug(deployment.public_url, deployment.project_name) == target_slug:
            return _to_detail(deployment)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


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
