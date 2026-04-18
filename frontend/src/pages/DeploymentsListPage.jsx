import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import StatusBadge from "../components/StatusBadge";
import api from "../services/api";

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}

export default function DeploymentsListPage() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await api.getDeployments();
        if (active) {
          setDeployments(data);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="neon-panel rounded-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg text-neon">Deployments</h2>
        <Link
          to="/deployments/new"
          className="rounded-md border border-neon/60 bg-neon/10 px-3 py-2 text-xs text-neon transition hover:bg-neon/20"
        >
          New Deployment
        </Link>
      </div>

      {loading ? <p className="text-sm text-emerald-300/70">Loading deployment list...</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-emerald-500/25 text-xs uppercase tracking-widest text-emerald-300/70">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((deployment) => (
              <tr key={deployment.id} className="border-b border-emerald-500/10 align-top">
                <td className="px-3 py-3 text-emerald-100">{deployment.project_name}</td>
                <td className="px-3 py-3 text-emerald-200/80">{deployment.project_type}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={deployment.status} />
                </td>
                <td className="max-w-xs px-3 py-3 text-emerald-200/80">
                  {deployment.public_url ? (
                    <a
                      href={deployment.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 break-all text-neon underline decoration-neon/35 underline-offset-2"
                    >
                      {deployment.public_url}
                    </a>
                  ) : (
                    <span>pending</span>
                  )}
                </td>
                <td className="px-3 py-3 text-emerald-300/80">{formatDate(deployment.created_at)}</td>
                <td className="px-3 py-3">
                  <Link
                    to={`/deployments/${deployment.id}`}
                    className="rounded border border-emerald-500/50 px-2 py-1 text-xs text-emerald-100 transition hover:border-neon hover:text-neon"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
