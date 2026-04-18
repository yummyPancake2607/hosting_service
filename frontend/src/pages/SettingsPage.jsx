import { useState } from "react";

import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function SettingsPage() {
  const { username } = useAuth();
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState(username || "testing");
  const [email, setEmail] = useState("testing@crisperhost.local");

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <form className="neon-panel rounded-md p-5" onSubmit={handleSubmit}>
        <h2 className="text-lg text-neon">Account Settings</h2>
        <p className="mt-1 text-sm text-emerald-300/70">Basic profile details for the current operator account.</p>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="mb-1 block text-xs text-emerald-300/75">Username</label>
            <input
              value={username || "testing"}
              disabled
              className="neon-input w-full cursor-not-allowed rounded-md px-3 py-2 opacity-80"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-emerald-300/75">Display Name</label>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="neon-input w-full rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-emerald-300/75">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="neon-input w-full rounded-md px-3 py-2"
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-5 rounded-md border border-neon bg-neon/10 px-4 py-2 text-sm font-semibold text-neon transition hover:bg-neon/20"
        >
          Save Settings
        </button>

        {saved ? (
          <p className="mt-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            Profile settings saved.
          </p>
        ) : null}
      </form>

      <aside className="neon-panel rounded-md p-5">
        <h3 className="text-sm uppercase tracking-widest text-emerald-300/75">Platform Profile</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="rounded border border-emerald-500/20 bg-black/35 px-3 py-2">
            <dt className="text-emerald-300/70">API Mode</dt>
            <dd className="text-neon">{api.isMockEnabled ? "Mock + Ready for FastAPI" : "FastAPI Live Mode"}</dd>
          </div>
          <div className="rounded border border-emerald-500/20 bg-black/35 px-3 py-2">
            <dt className="text-emerald-300/70">Region</dt>
            <dd className="text-emerald-100">University Datacenter</dd>
          </div>
          <div className="rounded border border-emerald-500/20 bg-black/35 px-3 py-2">
            <dt className="text-emerald-300/70">Runtime Tier</dt>
            <dd className="text-emerald-100">MVP Sandbox</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
