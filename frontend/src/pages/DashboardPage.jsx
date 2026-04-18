import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import StatusBadge from "../components/StatusBadge";
import api from "../services/api";

function randomMetric(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function MetricCard({ label, value, cap, unit }) {
  const width = Math.min(Math.round((value / cap) * 100), 100);

  return (
    <div className="neon-panel rounded-md p-4 card-enter">
      <p className="text-xs uppercase tracking-widest text-emerald-300/70">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neon">
        {value}
        {unit}
      </p>
      <div className="mt-3 h-2 rounded-full bg-emerald-950/80">
        <div className="h-2 rounded-full bg-neon transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ cpu: 42, ram: 58, network: 210 });

  useEffect(() => {
    let active = true;

    async function loadData() {
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

    loadData();
    const tick = setInterval(() => {
      setMetrics({
        cpu: randomMetric(25, 88),
        ram: randomMetric(33, 94),
        network: randomMetric(80, 420),
      });
    }, 2400);

    return () => {
      active = false;
      clearInterval(tick);
    };
  }, []);

  const statusCounts = useMemo(() => {
    return deployments.reduce(
      (acc, deployment) => {
        acc.total += 1;
        acc[deployment.status] = (acc[deployment.status] || 0) + 1;
        return acc;
      },
      { total: 0, Running: 0, Building: 0, Failed: 0 }
    );
  }, [deployments]);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="neon-panel rounded-md p-4 card-enter">
          <p className="text-xs uppercase tracking-widest text-emerald-300/70">Deployments</p>
          <p className="mt-2 text-3xl font-semibold text-neon">{statusCounts.total}</p>
        </div>
        <div className="neon-panel rounded-md p-4 card-enter">
          <p className="text-xs uppercase tracking-widest text-emerald-300/70">Running</p>
          <p className="mt-2 text-3xl font-semibold text-neon">{statusCounts.Running}</p>
        </div>
        <div className="neon-panel rounded-md p-4 card-enter">
          <p className="text-xs uppercase tracking-widest text-emerald-300/70">Building</p>
          <p className="mt-2 text-3xl font-semibold text-yellow-300">{statusCounts.Building}</p>
        </div>
        <div className="neon-panel rounded-md p-4 card-enter">
          <p className="text-xs uppercase tracking-widest text-emerald-300/70">Failed</p>
          <p className="mt-2 text-3xl font-semibold text-rose-300">{statusCounts.Failed}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="CPU" value={metrics.cpu} cap={100} unit="%" />
        <MetricCard label="RAM" value={metrics.ram} cap={100} unit="%" />
        <MetricCard label="Net Throughput" value={metrics.network} cap={500} unit=" Mbps" />
      </section>

      <section className="neon-panel rounded-md p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg text-neon">Recent Deployments</h2>
          <Link
            to="/deployments/new"
            className="rounded-md border border-neon bg-neon/10 px-3 py-2 text-sm text-neon transition hover:bg-neon/20"
          >
            New Deployment
          </Link>
        </div>

        {loading ? <p className="text-sm text-emerald-300/70">Fetching deployments...</p> : null}

        <div className="grid gap-3 lg:grid-cols-2">
          {deployments.map((deployment) => (
            <article key={deployment.id} className="rounded-md border border-emerald-500/20 bg-black/45 p-4 card-enter">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base text-emerald-100">{deployment.project_name}</h3>
                  <p className="text-xs text-emerald-300/65">{deployment.project_type}</p>
                </div>
                <StatusBadge status={deployment.status} />
              </div>

              <p className="mt-3 break-all text-xs text-emerald-300/70">{deployment.public_url || "pending URL"}</p>

              <div className="mt-4 flex gap-2">
                <Link
                  to={`/deployments/${deployment.id}`}
                  className="rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-100 transition hover:border-neon hover:text-neon"
                >
                  Open Details
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
