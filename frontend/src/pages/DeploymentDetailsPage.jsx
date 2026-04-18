import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import StatusBadge from "../components/StatusBadge";
import TerminalViewer from "../components/TerminalViewer";
import api from "../services/api";

export default function DeploymentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadDeployment = useCallback(async () => {
    try {
      const [deploymentData, logData] = await Promise.all([
        api.getDeployment(id),
        api.getLogs(id),
      ]);
      setDeployment(deploymentData);
      setLogs(logData);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not load deployment");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDeployment();
  }, [loadDeployment]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const logData = await api.getLogs(id);
        setLogs(logData);
      } catch {
        // Ignore intermittent polling errors for the MVP UI.
      }
    }, 2500);

    return () => clearInterval(poll);
  }, [id]);

  const envSummary = useMemo(() => deployment?.env_vars || [], [deployment]);

  const runAction = async (action, successMessage) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await loadDeployment();
      setNotice(successMessage);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!deployment?.public_url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(deployment.public_url);
      setNotice("Public URL copied");
    } catch {
      setNotice("Clipboard unavailable in this browser context");
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await api.deleteDeployment(id);
      navigate("/deployments", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-emerald-300/70">Loading deployment details...</p>;
  }

  if (!deployment) {
    return <p className="text-sm text-rose-300">{error || "Deployment not found"}</p>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <section className="space-y-4">
        <article className="neon-panel rounded-md p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-300/70">Deployment</p>
          <h2 className="mt-1 text-2xl text-neon">{deployment.project_name}</h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusBadge status={deployment.status} />
            <span className="rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-200">
              {deployment.project_type}
            </span>
          </div>

          <div className="mt-5 space-y-2 text-sm">
            <p className="text-emerald-300/70">Public URL</p>
            <p className="break-all rounded border border-emerald-500/25 bg-black/45 px-3 py-2 text-emerald-100">
              {deployment.public_url || "Provisioning"}
            </p>
            {deployment.runtime_url ? (
              <>
                <p className="text-emerald-300/70">Runtime URL</p>
                <a
                  href={deployment.runtime_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all rounded border border-neon/30 bg-neon/10 px-3 py-2 text-neon"
                >
                  {deployment.runtime_url}
                </a>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-emerald-500/50 px-3 py-2 text-xs text-emerald-100 transition hover:border-neon hover:text-neon"
            >
              Copy URL
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => api.restartDeployment(id), "Restart requested")}
              className="rounded-md border border-neon/60 bg-neon/10 px-3 py-2 text-xs text-neon transition hover:bg-neon/20 disabled:opacity-60"
            >
              Restart
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => api.stopDeployment(id), "Stop requested")}
              className="rounded-md border border-yellow-500/60 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-60"
            >
              Stop
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
            >
              Delete
            </button>
          </div>

          {notice ? (
            <p className="mt-4 rounded border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          ) : null}
        </article>

        <article className="neon-panel rounded-md p-5">
          <h3 className="text-sm text-neon">Environment Variables</h3>
          {envSummary.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-300/70">No environment variables configured.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {envSummary.map((item) => (
                <li key={item.id} className="rounded border border-emerald-500/20 bg-black/35 px-3 py-2">
                  <span className="text-neon">{item.key}</span>
                  <span className="mx-2 text-emerald-500/50">=</span>
                  <span className="text-emerald-100/90">{item.value}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <TerminalViewer title="LIVE DEPLOYMENT LOGS" lines={logs} heightClass="h-[620px]" showCursor />
    </div>
  );
}
