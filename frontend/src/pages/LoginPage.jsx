import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const bootSequence = [
  "boot:: initializing CRISPERHOST access gateway",
  "boot:: syncing runtime signatures",
  "boot:: validating edge credentials",
  "boot:: route-map online",
  "boot:: ready for operator login",
];

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(0,255,136,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(0,255,136,0.12),transparent_30%)]" />

      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
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
    </div>
  );
}
