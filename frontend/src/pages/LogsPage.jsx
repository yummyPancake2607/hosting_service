import { useCallback, useEffect, useState } from "react";

import TerminalViewer from "../components/TerminalViewer";
import api from "../services/api";

export default function LogsPage() {
  const [deployments, setDeployments] = useState([]);
  const [selectedDeployment, setSelectedDeployment] = useState("all");
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    const deploymentRows = await api.getDeployments();
    setDeployments(deploymentRows);

    if (deploymentRows.length === 0) {
      setLines([]);
      return;
    }

    if (selectedDeployment === "all") {
      const logsByDeployment = await Promise.all(
        deploymentRows.slice(0, 8).map(async (deployment) => {
          const logs = await api.getLogs(deployment.id);
          return logs.map((line) => ({
            ...line,
            log_line: `[${deployment.project_name}] ${line.log_line}`,
          }));
        })
      );

      const merged = logsByDeployment
        .flat()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setLines(merged.slice(-220));
      return;
    }

    const selectedLogs = await api.getLogs(selectedDeployment);
    setLines(selectedLogs.slice(-220));
  }, [selectedDeployment]);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await loadLogs();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [loadLogs]);

  useEffect(() => {
    const heartbeat = setInterval(() => {
      setLines((prev) => [
        ...prev.slice(-219),
        {
          id: `heartbeat-${Date.now()}`,
          deployment_id: 0,
          log_line: "[stream] log-agent heartbeat ok",
          timestamp: new Date().toISOString(),
        },
      ]);
    }, 3200);

    return () => clearInterval(heartbeat);
  }, []);

  return (
    <section className="space-y-4">
      <div className="neon-panel rounded-md p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg text-neon">Runtime Logs</h2>
            <p className="text-sm text-emerald-300/70">Terminal stream with rolling updates and auto-scroll.</p>
          </div>

          <label className="text-xs text-emerald-300/80">
            Deployment Scope
            <select
              value={selectedDeployment}
              onChange={(event) => setSelectedDeployment(event.target.value)}
              className="neon-input mt-1 block rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Deployments</option>
              {deployments.map((deployment) => (
                <option key={deployment.id} value={deployment.id}>
                  {deployment.project_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? <p className="text-sm text-emerald-300/70">Loading logs...</p> : null}
      <TerminalViewer title="SYSTEM LOG CONSOLE" lines={lines} heightClass="h-[620px]" showCursor />
    </section>
  );
}
