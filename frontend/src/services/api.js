import axios from "axios";

function isLocalHostName(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "0.0.0.0";
}

function getBrowserLocation() {
  const root = typeof globalThis === "object" && globalThis !== null ? globalThis : null;
  const location = root && "location" in root ? root.location : null;

  if (!location || typeof location.origin !== "string" || typeof location.host !== "string") {
    return null;
  }

  return location;
}

const browserLocation = getBrowserLocation();
const isViteDevServer = Boolean(browserLocation && /:(5173|4173)$/.test(browserLocation.host));
const DEFAULT_API_BASE_URL =
  isViteDevServer || !browserLocation ? "http://127.0.0.1:8000" : browserLocation.origin;

function resolveApiBaseUrl(rawValue) {
  const candidate = String(rawValue ?? "").trim();
  if (!candidate) {
    return DEFAULT_API_BASE_URL;
  }

  if (!browserLocation || isViteDevServer) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate, browserLocation.origin);
    if (isLocalHostName(parsed.hostname)) {
      return browserLocation.origin;
    }
  } catch {
    return candidate;
  }

  return candidate;
}

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
const USE_MOCK_API = (import.meta.env.VITE_USE_MOCK_API ?? "false").toLowerCase() === "true";
const DEFAULT_PUBLIC_BASE_URL = browserLocation?.origin || "http://localhost:5173";

function resolvePublicBaseUrl(rawValue) {
  const candidate = String(rawValue ?? "").trim();
  if (!candidate) {
    return DEFAULT_PUBLIC_BASE_URL.replace(/\/+$/, "");
  }

  if (!browserLocation || isViteDevServer) {
    return candidate.replace(/\/+$/, "");
  }

  try {
    const parsed = new URL(candidate, browserLocation.origin);
    if (isLocalHostName(parsed.hostname)) {
      return browserLocation.origin.replace(/\/+$/, "");
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return candidate.replace(/\/+$/, "");
  }
}

const PUBLIC_DEPLOYMENT_BASE_URL = resolvePublicBaseUrl(import.meta.env.VITE_PUBLIC_DEPLOYMENT_BASE_URL);
const MOCK_STORAGE_KEY = "crisperhost_mock_deployments";

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isFileLike(value) {
  return typeof File !== "undefined" && value instanceof File;
}

function stripZipExtension(name) {
  return String(name || "project").replace(/\.zip$/i, "") || "project";
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function toIso(deltaMs = 0) {
  return new Date(Date.now() + deltaMs).toISOString();
}

function slugFromPublicUrl(url) {
  if (!url) {
    return "";
  }

  const trimmed = String(url).trim().replace(/\/+$/, "");
  if (!trimmed.includes("/")) {
    return trimmed;
  }

  return trimmed.substring(trimmed.lastIndexOf("/") + 1);
}

function deploymentSlug(item) {
  return slugFromPublicUrl(item.public_url) || slugify(item.project_name);
}

function createPublicUrl(projectName, existingDeployments = []) {
  const existingSlugs = new Set(existingDeployments.map((item) => deploymentSlug(item)));
  const baseSlug = slugify(projectName);
  let candidate = baseSlug;
  let attempt = 2;

  while (existingSlugs.has(candidate)) {
    candidate = `${baseSlug}-${attempt}`;
    attempt += 1;
  }

  return `${PUBLIC_DEPLOYMENT_BASE_URL}/${candidate}`;
}

function readMockDeployments() {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY);
  if (!raw) {
    const seeded = seedDeployments();
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const seeded = seedDeployments();
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeMockDeployments(items) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(items));
}

function seedDeployments() {
  return [
    {
      id: 1,
      project_name: "campus-portal",
      project_type: "React",
      status: "Running",
      public_url: `${PUBLIC_DEPLOYMENT_BASE_URL}/campus-portal`,
      runtime_url: null,
      created_at: toIso(-3600_000),
      build_command: "npm run build",
      run_command: "npm run start",
      env_vars: [{ id: 1, key: "NODE_ENV", value: "production" }],
      logs: [
        { id: 1, deployment_id: 1, log_line: "[build] npm install", timestamp: toIso(-3500_000) },
        { id: 2, deployment_id: 1, log_line: "[build] npm run build", timestamp: toIso(-3400_000) },
        { id: 3, deployment_id: 1, log_line: "[ready] Service online", timestamp: toIso(-3300_000) },
      ],
    },
    {
      id: 2,
      project_name: "iot-lab-api",
      project_type: "FastAPI",
      status: "Building",
      public_url: `${PUBLIC_DEPLOYMENT_BASE_URL}/iot-lab-api`,
      runtime_url: null,
      created_at: toIso(-900_000),
      build_command: "pip install -r requirements.txt",
      run_command: "uvicorn main:app --host 0.0.0.0 --port 8000",
      env_vars: [{ id: 2, key: "ENV", value: "staging" }],
      logs: [
        { id: 4, deployment_id: 2, log_line: "[scan] Checking archive", timestamp: toIso(-850_000) },
        { id: 5, deployment_id: 2, log_line: "[build] Installing dependencies", timestamp: toIso(-800_000) },
      ],
    },
    {
      id: 3,
      project_name: "legacy-admin",
      project_type: "Node",
      status: "Failed",
      public_url: `${PUBLIC_DEPLOYMENT_BASE_URL}/legacy-admin`,
      runtime_url: null,
      created_at: toIso(-7_200_000),
      build_command: "npm run build",
      run_command: "npm run start",
      env_vars: [],
      logs: [
        { id: 6, deployment_id: 3, log_line: "[build] Missing dependency: sharp", timestamp: toIso(-7_100_000) },
      ],
    },
  ];
}

function getNextDeploymentId(items) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function getNextLogId(items) {
  return (
    items
      .flatMap((item) => item.logs || [])
      .reduce((max, log) => Math.max(max, log.id), 0) + 1
  );
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function mockLogin({ username, password }) {
  await sleep(650);
  if (username === "testing" && password === "123") {
    return {
      access_token: `mock-${Date.now()}`,
      username: "testing",
    };
  }

  throw new Error("Invalid username or password");
}

async function mockGetDeployments() {
  await sleep(260);
  return sortByDateDesc(readMockDeployments());
}

async function mockDeploy(payload) {
  await sleep(900);
  const deployments = readMockDeployments();
  const deploymentId = getNextDeploymentId(deployments);
  let nextLogId = getNextLogId(deployments);
  const createdAt = toIso();
  const publicUrl = createPublicUrl(payload.project_name, deployments);

  const stagedLogs = [
    `[ingest] Upload accepted for ${payload.project_name}.zip`,
    "[scan] Running security checks",
    `[build] ${payload.build_command}`,
    "[build] Build finished",
    `[run] ${payload.run_command}`,
    `[ready] Public URL ${publicUrl}`,
  ];

  const logs = stagedLogs.map((line, index) => ({
    id: nextLogId + index,
    deployment_id: deploymentId,
    log_line: line,
    timestamp: toIso(index * 320),
  }));

  const deployment = {
    id: deploymentId,
    project_name: payload.project_name,
    project_type: payload.project_type,
    status: "Building",
    public_url: publicUrl,
    runtime_url: null,
    created_at: createdAt,
    build_command: payload.build_command,
    run_command: payload.run_command,
    env_vars: (payload.env_vars || []).map((item, idx) => ({
      id: idx + 1,
      key: item.key,
      value: item.value,
    })),
    logs,
  };

  deployments.unshift(deployment);
  writeMockDeployments(deployments);

  setTimeout(() => {
    const latest = readMockDeployments();
    const target = latest.find((item) => item.id === deploymentId);
    if (!target) {
      return;
    }

    const maxLogId = getNextLogId(latest);
    target.status = "Running";
    target.logs.push({
      id: maxLogId,
      deployment_id: deploymentId,
      log_line: "[watchdog] Container health check passed",
      timestamp: toIso(),
    });
    writeMockDeployments(latest);
  }, 2500);

  return deployment;
}

async function mockGetDeployment(id) {
  await sleep(250);
  const deployment = readMockDeployments().find((item) => item.id === Number(id));
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  return deployment;
}

async function mockGetDeploymentBySlug(slug) {
  await sleep(180);
  const normalizedSlug = slugify(slug || "");
  const deployment = readMockDeployments().find(
    (item) => deploymentSlug(item) === normalizedSlug
  );

  if (!deployment) {
    throw new Error("Deployment not found");
  }

  return deployment;
}

async function mockGetLogs(id) {
  await sleep(180);
  const deployment = readMockDeployments().find((item) => item.id === Number(id));
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  return deployment.logs;
}

async function mockRestartDeployment(id) {
  const deployments = readMockDeployments();
  const target = deployments.find((item) => item.id === Number(id));
  if (!target) {
    throw new Error("Deployment not found");
  }

  const nextLogId = getNextLogId(deployments);
  target.status = "Building";
  target.logs.push({
    id: nextLogId,
    deployment_id: target.id,
    log_line: "[control] Restart requested",
    timestamp: toIso(),
  });
  writeMockDeployments(deployments);

  setTimeout(() => {
    const current = readMockDeployments();
    const item = current.find((entry) => entry.id === Number(id));
    if (!item) {
      return;
    }

    const idAfter = getNextLogId(current);
    item.status = "Running";
    item.logs.push({
      id: idAfter,
      deployment_id: item.id,
      log_line: "[control] Restart complete",
      timestamp: toIso(),
    });
    writeMockDeployments(current);
  }, 1600);

  await sleep(220);
  return { ok: true };
}

async function mockStopDeployment(id) {
  const deployments = readMockDeployments();
  const target = deployments.find((item) => item.id === Number(id));
  if (!target) {
    throw new Error("Deployment not found");
  }

  target.status = "Failed";
  target.logs.push({
    id: getNextLogId(deployments),
    deployment_id: target.id,
    log_line: "[control] Service stopped by user",
    timestamp: toIso(),
  });
  writeMockDeployments(deployments);

  await sleep(220);
  return { ok: true };
}

async function mockDeleteDeployment(id) {
  const deployments = readMockDeployments().filter((item) => item.id !== Number(id));
  writeMockDeployments(deployments);
  await sleep(200);
  return { ok: true };
}

async function mockDetectArchive(file) {
  await sleep(180);
  const label = stripZipExtension(file?.name || "project");
  const normalized = label.toLowerCase();

  if (normalized.includes("react") || normalized.includes("vite")) {
    return {
      project_name: label,
      project_type: "React",
      build_command: "npm run build",
      run_command: "",
    };
  }

  if (normalized.includes("node") || normalized.includes("express")) {
    return {
      project_name: label,
      project_type: "Node",
      build_command: "npm install",
      run_command: "npm run start",
    };
  }

  if (normalized.includes("python") || normalized.includes("fastapi") || normalized.includes("flask")) {
    return {
      project_name: label,
      project_type: "Python",
      build_command: "pip install -r requirements.txt",
      run_command: "uvicorn main:app --host 0.0.0.0 --port 8000",
    };
  }

  if (normalized.includes("static") || normalized.includes("index") || normalized.includes("html")) {
    return {
      project_name: label,
      project_type: "Static",
      build_command: "",
      run_command: "",
    };
  }

  return {
    project_name: label,
    project_type: "Unknown",
    build_command: "npm install",
    run_command: "npm run dev",
  };
}

const api = {
  isMockEnabled: USE_MOCK_API,

  async login(credentials) {
    if (USE_MOCK_API) {
      return mockLogin(credentials);
    }

    const { data } = await http.post("/login", credentials);
    return data;
  },

  async getDeployments() {
    if (USE_MOCK_API) {
      return mockGetDeployments();
    }

    const { data } = await http.get("/deployments");
    return data;
  },

  async detectArchive(sourceArchive) {
    if (!isFileLike(sourceArchive)) {
      throw new Error("A ZIP archive is required for detection");
    }

    if (USE_MOCK_API) {
      return mockDetectArchive(sourceArchive);
    }

    const formData = new FormData();
    formData.append("source_archive", sourceArchive);

    const { data } = await http.post("/deploy/detect", formData);
    return data;
  },

  async deploy(payload) {
    if (USE_MOCK_API) {
      return mockDeploy(payload);
    }

    if (isFileLike(payload?.source_archive)) {
      const formData = new FormData();
      formData.append("project_name", payload.project_name || "project");
      formData.append("project_type", payload.project_type ?? "Unknown");
      formData.append("build_command", payload.build_command ?? "npm install");
      formData.append("run_command", payload.run_command ?? "npm run dev");
      formData.append("env_vars_json", JSON.stringify(payload.env_vars || []));
      formData.append("source_archive", payload.source_archive);

      const { data } = await http.post("/deploy/upload", formData);
      return data;
    }

    const { data } = await http.post("/deploy", payload);
    return data;
  },

  async getDeployment(id) {
    if (USE_MOCK_API) {
      return mockGetDeployment(id);
    }

    const { data } = await http.get(`/deployment/${id}`);
    return data;
  },

  async getDeploymentBySlug(slug) {
    if (USE_MOCK_API) {
      return mockGetDeploymentBySlug(slug);
    }

    const { data } = await http.get(`/deployment/slug/${encodeURIComponent(slug)}`);
    return data;
  },

  async getLogs(id) {
    if (USE_MOCK_API) {
      return mockGetLogs(id);
    }

    const { data } = await http.get(`/logs/${id}`);
    return data;
  },

  async restartDeployment(id) {
    if (USE_MOCK_API) {
      return mockRestartDeployment(id);
    }

    return { ok: true, message: `Restart simulated for deployment ${id}` };
  },

  async stopDeployment(id) {
    if (USE_MOCK_API) {
      return mockStopDeployment(id);
    }

    return { ok: true, message: `Stop simulated for deployment ${id}` };
  },

  async deleteDeployment(id) {
    if (USE_MOCK_API) {
      return mockDeleteDeployment(id);
    }

    return { ok: true, message: `Delete simulated for deployment ${id}` };
  },
};

export default api;
