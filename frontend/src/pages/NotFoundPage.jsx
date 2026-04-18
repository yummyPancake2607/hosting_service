import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="neon-panel w-full max-w-lg rounded-md p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-emerald-300/75">404</p>
        <h1 className="mt-2 text-3xl text-neon">Route Not Found</h1>
        <p className="mt-3 text-sm text-emerald-200/70">The page you requested does not exist in this deployment panel.</p>
        <Link
          to={isAuthenticated ? "/" : "/login"}
          className="mt-5 inline-flex rounded-md border border-neon bg-neon/10 px-4 py-2 text-sm text-neon transition hover:bg-neon/20"
        >
          Return to {isAuthenticated ? "Dashboard" : "Login"}
        </Link>
      </div>
    </div>
  );
}
