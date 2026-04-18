import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import challengesPdf from "../../Lessons-Learned-Container-Deployment-Challenges.pdf";
import visionPdf from "../../CRIPER_Vision.pdf";

const bootSequence = [
  "boot:: initializing CRISPERHOST access gateway",
  "boot:: syncing runtime signatures",
  "boot:: validating edge credentials",
  "boot:: route-map online",
  "boot:: ready for operator login",
];

function LoginArchiveCard({ code, title, subtitle, note, actionText, href }) {
  return (
    <article className="login-archive-card rounded-md p-5">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neon">{code}</p>
          <h2 className="mt-2 text-2xl font-semibold text-emerald-100">{title}</h2>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-300/70">{subtitle}</p>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="login-archive-link rounded-md px-4 py-2 text-xs uppercase tracking-[0.18em] text-emerald-50"
        >
          {actionText}
        </a>
      </div>

      <div className="relative z-10 mt-4 rounded-md border border-emerald-500/25 bg-black/45 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-neon/90">Archive Note</p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-100/82">{note}</p>
      </div>
    </article>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const [username, setUsername] = useState("testing");
  const [password, setPassword] = useState("123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visibleLines, setVisibleLines] = useState([]);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      setVisibleLines((prev) => [...prev, bootSequence[index]]);
      index += 1;
      if (index >= bootSequence.length) {
        clearInterval(timer);
      }
    }, 260);

    return () => clearInterval(timer);
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 900));

    try {
      await login({ username, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 md:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(0,255,136,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(0,255,136,0.12),transparent_30%)]" />

      <div className="mx-auto w-full max-w-6xl space-y-7">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="terminal-window rounded-md p-5">
            <p className="mb-3 text-xs text-emerald-300/75">SYSTEM BOOT LOG</p>
            <div className="space-y-2 text-sm text-emerald-100/85">
              {visibleLines.map((line, index) => (
                <p key={`${line}-${index}`} className="boot-line" style={{ animationDelay: `${index * 55}ms` }}>
                  &gt; {line}
                </p>
              ))}
              <p className="text-neon">
                &gt; waiting for credentials <span className="cursor-blink">_</span>
              </p>
            </div>

            <div className="mt-6 border-t border-emerald-500/20 pt-4 text-xs text-emerald-300/70">
              <p>Temporary user for MVP</p>
              <p>username: testing</p>
              <p>password: 123</p>
            </div>
          </section>

          <section className="neon-panel rounded-md p-6">
            <p className="text-xs uppercase tracking-widest text-emerald-300/70">Operator Console</p>
            <h1 className="mt-2 text-3xl font-semibold text-neon">Sign In</h1>
            <p className="mt-2 text-sm text-emerald-200/70">Authenticate to deploy and monitor student projects.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="username" className="mb-1 block text-xs text-emerald-300/80">
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="neon-input w-full rounded-md px-3 py-2"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-xs text-emerald-300/80">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="neon-input w-full rounded-md px-3 py-2"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? (
                <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md border border-neon bg-neon/15 px-4 py-2 text-sm font-semibold text-neon transition hover:bg-neon/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Authenticating..." : "Enter CRISPERHOST"}
              </button>
            </form>
          </section>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/75">Knowledge Archive</p>
              <h2 className="mt-1 text-2xl font-semibold text-neon">Vision And Lessons</h2>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/65">Open As PDF</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <LoginArchiveCard
              code="VC_01"
              title="THE 15-YEAR LETTER"
              subtitle="VISION // TIME CAPSULE ARCHIVE"
              note="My vision for 2040 is stored in CRIPER_Vision.pdf as a long-horizon letter for future builders."
              actionText="OPEN LETTER 2040"
              href={visionPdf}
            />

            <LoginArchiveCard
              code="TC_04"
              title="DEPLOYMENT CHALLENGES"
              subtitle="LESSONS // CONTAINER REALITY"
              note="All key deployment pain points and fixes are documented in Lessons-Learned-Container-Deployment-Challenges.pdf."
              actionText="OPEN CHALLENGES"
              href={challengesPdf}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
