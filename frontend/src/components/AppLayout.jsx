import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ServerPulse from "./ServerPulse";

const navigationItems = [
  { label: "Dashboard", to: "/" },
  { label: "Deployments", to: "/deployments" },
  { label: "New Deployment", to: "/deployments/new" },
  { label: "Logs", to: "/logs" },
  { label: "Settings", to: "/settings" },
];

function navClass({ isActive }) {
  return [
    "rounded-md px-3 py-2 text-sm border transition-colors",
    isActive
      ? "border-neon text-neon bg-neon/10"
      : "border-transparent text-emerald-200/80 hover:border-emerald-500/50 hover:text-neon",
  ].join(" ");
}

export default function AppLayout() {
  const navigate = useNavigate();
  const { logout, username } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-emerald-400/20 bg-black/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-neon bg-neon/10 text-neon">
              CH
            </span>
            <div>
              <p className="text-sm text-emerald-300/70">Self-Hosted PaaS</p>
              <h1 className="text-xl font-semibold tracking-widest text-neon">CRISPERHOST</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ServerPulse />
            <div className="hidden text-right md:block">
              <p className="text-xs text-emerald-200/60">signed in as</p>
              <p className="text-sm text-emerald-100">{username}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-emerald-500/50 px-3 py-2 text-sm text-emerald-100 transition hover:border-neon hover:text-neon"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col md:flex-row">
        <aside className="border-b border-emerald-400/20 bg-black/45 p-4 md:w-64 md:border-b-0 md:border-r">
          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1">
            {navigationItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
