import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import StatusBadge from "../components/StatusBadge";
import TerminalViewer from "../components/TerminalViewer";
import api from "../services/api";

function detectProjectType(name) {
  const input = (name || "").toLowerCase();
  if (input.includes("react") || input.includes("vite")) {
    return "React";
  }
  if (input.includes("next")) {
    return "Next.js";
  }
  if (input.includes("fastapi") || input.includes("flask") || input.includes("django")) {
    return "Python";
  }
  if (input.includes("node") || input.includes("express")) {
    return "Node";
  }
  if (input.includes("static") || input.includes("html") || input.includes("index")) {
    return "Static";
  }
  return "Unknown";
}

function defaultCommandsFor(type) {
  if (type === "React") {
    return {
      build: "npm run build",
      run: "",
    };
  }

  if (type === "Node" || type === "Next.js") {
    return {
      build: "npm install",
      run: "npm run start",
    };
  }

  if (type === "Python") {
    return {
      build: "pip install -r requirements.txt",
      run: "uvicorn main:app --host 0.0.0.0 --port 8000",
    };
  }

  if (type === "Static") {
    return {
      build: "",
      run: "",
    };
  }

  return {
    build: "npm install",
    run: "npm run dev",
  };
}

export default function NewDeploymentPage() {
  const [projectName, setProjectName] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [runCommand, setRunCommand] = useState("");
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }]);
  const [requiredEnvKeys, setRequiredEnvKeys] = useState([]);
  const [optionalEnvKeys, setOptionalEnvKeys] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [projectTypeHint, setProjectTypeHint] = useState("");
  const [detectingArchive, setDetectingArchive] = useState(false);
  const [archiveNotice, setArchiveNotice] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState("");
  const [deployment, setDeployment] = useState(null);
  const [liveLines, setLiveLines] = useState([]);

  const inferredType = useMemo(
    () => detectProjectType(projectName || selectedFile?.name),
    [projectName, selectedFile]
  );
  const detectedType = projectTypeHint || inferredType;

  const deploymentStatus = deployment?.status || "Building";

  useEffect(() => {
    const defaults = defaultCommandsFor(detectedType);
    if (!buildCommand.trim()) {
      setBuildCommand(defaults.build);
    }
    if (!runCommand.trim()) {
      setRunCommand(defaults.run);
    }
  }, [detectedType, buildCommand, runCommand]);

  useEffect(() => {
    if (!deployment?.id) {
      return;
    }

    let active = true;

    const poll = async () => {
      try {
        const [freshDeployment, freshLogs] = await Promise.all([
          api.getDeployment(deployment.id),
          api.getLogs(deployment.id),
        ]);

        if (!active) {
          return;
        }

        setDeployment(freshDeployment);
        setLiveLines(Array.isArray(freshLogs) ? freshLogs : []);
      } catch {
        // Ignore transient polling errors and keep existing data.
      }
    };

    poll();
    const timer = setInterval(poll, 800);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [deployment?.id]);

  const detectArchiveProfile = async (file) => {
    if (!file) {
      return;
    }

    setDetectingArchive(true);
    setArchiveNotice("Analyzing archive for deployment profile...");

    try {
      const profile = await api.detectArchive(file);
      const detectedRequiredEnvKeys = Array.isArray(profile?.required_env_vars)
        ? profile.required_env_vars.filter((item) => typeof item === "string" && item.startsWith("VITE_"))
        : [];
      const detectedOptionalEnvKeys = Array.isArray(profile?.optional_env_vars)
        ? profile.optional_env_vars.filter((item) => typeof item === "string" && item.startsWith("VITE_"))
        : [];

      if (profile?.project_name) {
        setProjectName((current) => (current.trim() ? current : profile.project_name));
      }

      setProjectTypeHint(profile?.project_type || "");
      setBuildCommand(profile?.build_command ?? "");
      setRunCommand(profile?.run_command ?? "");
      setRequiredEnvKeys(detectedRequiredEnvKeys);
      setOptionalEnvKeys(detectedOptionalEnvKeys);

      setArchiveNotice(
        `Detected ${profile?.project_type || "Unknown"} profile. ` +
          `Build: ${profile?.build_command || "none"} | Run: ${profile?.run_command || "none"}`
      );
    } catch (err) {
      setProjectTypeHint("");
      setRequiredEnvKeys([]);
      setOptionalEnvKeys([]);
      setArchiveNotice(
        err?.response?.data?.detail || err?.message || "Could not detect archive profile."
      );
    } finally {
      setDetectingArchive(false);
    }
  };

  const setFile = (file) => {
    if (!file) {
      return;
    }

    setArchiveNotice("");
    setProjectTypeHint("");
    setRequiredEnvKeys([]);
    setOptionalEnvKeys([]);
    setSelectedFile(file);
    const suggested = file.name.replace(/\.zip$/i, "");
    setProjectName((current) => (current.trim() ? current : suggested));

    void detectArchiveProfile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const [file] = event.dataTransfer.files;
    setFile(file);
  };

  const updateEnv = (index, key, value) => {
    setEnvVars((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    );
  };

  const addEnv = () => {
    setEnvVars((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeEnv = (index) => {
    setEnvVars((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDeploy = async (event) => {
    event.preventDefault();
    setDeployError("");
    setDeploying(true);
    setDeployment(null);
    setLiveLines([]);

    if (!api.isMockEnabled && !selectedFile) {
      setDeploying(false);
      setDeployError("Upload a ZIP archive for real deployment execution.");
      return;
    }

    const missingRequiredKeys = requiredEnvKeys.filter(
      (requiredKey) =>
        !envVars.some(
          (row) => row.key.trim() === requiredKey && String(row.value || "").trim().length > 0
        )
    );

    if (missingRequiredKeys.length) {
      setDeploying(false);
      setDeployError(`Missing required environment variables: ${missingRequiredKeys.join(", ")}`);
      return;
    }

    try {
      const payload = {
        project_name: projectName,
        project_type: detectedType,
        build_command: buildCommand,
        run_command: runCommand,
        env_vars: envVars
          .filter((item) => item.key.trim())
          .map((item) => ({ key: item.key.trim(), value: item.value })),
        source_archive: selectedFile,
      };

      const response = await api.deploy(payload);
      setDeployment(response);
      setLiveLines(Array.isArray(response?.logs) ? response.logs : []);
    } catch (err) {
      setDeployError(err?.response?.data?.detail || err?.message || "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <form className="neon-panel rounded-md p-5" onSubmit={handleDeploy}>
        <h2 className="text-lg text-neon">New Deployment</h2>
        <p className="mt-1 text-sm text-emerald-300/70">Upload a zip archive and configure build/runtime commands.</p>

        <label
          className={`mt-5 block rounded-md border border-dashed p-5 text-center transition ${
            dragActive ? "border-neon bg-neon/10" : "border-emerald-500/35 bg-black/40"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
          <p className="text-sm text-emerald-200">Drag and drop ZIP here or click to browse</p>
          <p className="mt-1 text-xs text-emerald-300/60">{selectedFile ? selectedFile.name : "No archive selected"}</p>
        </label>

        {detectingArchive ? (
          <p className="mt-2 text-xs text-neon">Analyzing archive...</p>
        ) : archiveNotice ? (
          <p className="mt-2 text-xs text-emerald-300/75">{archiveNotice}</p>
        ) : null}

        <div className="mt-4 grid gap-3">
          <div>
            <label className="mb-1 block text-xs text-emerald-300/70">Project Name</label>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              className="neon-input w-full rounded-md px-3 py-2"
              placeholder="my-campus-app"
              required
            />
          </div>

          <div className="rounded-md border border-emerald-500/20 bg-black/35 px-3 py-2 text-sm text-emerald-100">
            Detected Project Type: <span className="text-neon">{detectedType}</span>
          </div>

          <div>
            <label className="mb-1 block text-xs text-emerald-300/70">Build Command</label>
            <input
              value={buildCommand}
              onChange={(event) => setBuildCommand(event.target.value)}
              className="neon-input w-full rounded-md px-3 py-2"
              placeholder={
                detectedType === "Static"
                  ? "(none)"
                  : detectedType === "React"
                    ? "npm run build"
                    : "npm install"
              }
              required={detectedType !== "Static"}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-emerald-300/70">Run Command</label>
            <input
              value={runCommand}
              onChange={(event) => setRunCommand(event.target.value)}
              className="neon-input w-full rounded-md px-3 py-2"
              placeholder={detectedType === "Static" || detectedType === "React" ? "(optional)" : "npm run start"}
            />
            <p className="mt-1 text-xs text-emerald-300/60">
              Leave blank to serve build artifacts directly.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-emerald-500/20 bg-black/30 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm text-neon">Environment Variables</h3>
            <button
              type="button"
              onClick={addEnv}
              className="rounded border border-emerald-500/50 px-2 py-1 text-xs text-emerald-200 transition hover:border-neon hover:text-neon"
            >
              Add Row
            </button>
          </div>

          {requiredEnvKeys.length ? (
            <p className="mb-2 text-xs text-emerald-200/80">
              Required by detected project: {requiredEnvKeys.join(", ")}
            </p>
          ) : null}

          {optionalEnvKeys.length ? (
            <p className="mb-2 text-xs text-emerald-300/70">
              Optional compatibility keys: {optionalEnvKeys.join(", ")} (can be empty for PostgreSQL-only apps)
            </p>
          ) : null}

          <div className="space-y-2">
            {envVars.map((row, index) => (
              <div key={`env-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={row.key}
                  onChange={(event) => updateEnv(index, "key", event.target.value)}
                  className="neon-input rounded-md px-3 py-2"
                  placeholder="KEY"
                />
                <input
                  value={row.value}
                  onChange={(event) => updateEnv(index, "value", event.target.value)}
                  className="neon-input rounded-md px-3 py-2"
                  placeholder="value"
                />
                <button
                  type="button"
                  onClick={() => removeEnv(index)}
                  className="rounded border border-rose-500/50 px-2 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {deployError ? (
          <p className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{deployError}</p>
        ) : null}

        <button
          type="submit"
          disabled={deploying || detectingArchive}
          className="mt-5 w-full rounded-md border border-neon bg-neon/10 px-4 py-2 text-sm font-semibold text-neon transition hover:bg-neon/20 disabled:opacity-60"
        >
          {deploying ? "Deploying..." : "Deploy"}
        </button>
      </form>

      <section className="space-y-4">
        <TerminalViewer
          title="DEPLOYMENT TERMINAL"
          lines={liveLines}
          heightClass="h-[430px]"
          showCursor={Boolean(deployment)}
        />

        {deployment ? (
          <article className="neon-panel rounded-md p-4">
            <p className="text-xs text-emerald-300/75">Deployment Created</p>
            <h3 className="mt-1 text-lg text-neon">{deployment.project_name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={deploymentStatus} />
              <span className="rounded border border-emerald-500/30 px-2 py-1 text-xs text-emerald-200/90">
                ID #{deployment.id}
              </span>
            </div>
            <p className="mt-2 break-all text-sm text-emerald-100/80">{deployment.public_url || "URL provisioning"}</p>
            {deployment.runtime_url ? (
              <a
                href={deployment.runtime_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all rounded border border-neon/30 bg-neon/10 px-3 py-2 text-xs text-neon"
              >
                Runtime URL: {deployment.runtime_url}
              </a>
            ) : (
              <p className="mt-2 text-xs text-emerald-300/70">Runtime URL will appear once the app starts.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={deployment.public_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-md border border-neon/60 bg-neon/10 px-3 py-2 text-xs text-neon transition hover:bg-neon/20"
              >
                Open Live URL
              </a>
              <Link
                to={`/deployments/${deployment.id}`}
                className="inline-flex rounded-md border border-emerald-500/50 px-3 py-2 text-xs text-emerald-100 transition hover:border-neon hover:text-neon"
              >
                Open Deployment Details
              </Link>
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}
