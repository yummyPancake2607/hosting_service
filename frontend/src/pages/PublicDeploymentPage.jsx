import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";

export default function PublicDeploymentPage() {
  const { deploymentSlug = "" } = useParams();
  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDeployment() {
      setLoading(true);
      setError("");
      try {
        const data = await api.getDeploymentBySlug(deploymentSlug);
        if (!active) {
          return;
        }

        setDeployment(data);
      } catch (err) {
        if (!active) {
          return;
        }

        setDeployment(null);
        setError(err?.response?.data?.detail || err?.message || "Deployment endpoint not found");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDeployment();

    return () => {
      active = false;
    };
  }, [deploymentSlug]);

  const runtimeUrl = deployment?.runtime_url || "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-emerald-300/80">
        Opening deployment endpoint...
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <section className="w-full max-w-2xl rounded-md border border-rose-500/35 bg-black/70 p-6 text-rose-200">
          <h1 className="text-xl">Deployment Not Found</h1>
          <p className="mt-2 text-sm text-rose-200/80">No deployment matched /{deploymentSlug}</p>
          {error ? <p className="mt-3 text-sm text-rose-300/90">{error}</p> : null}
        </section>
      </div>
    );
  }

  if (runtimeUrl) {
    return (
      <div className="fixed inset-0 bg-black">
        <iframe
          title={`${deployment.project_name} runtime`}
          src={runtimeUrl}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center text-emerald-200">
      <section className="w-full max-w-2xl rounded-md border border-emerald-500/30 bg-black/75 p-6">
        <h1 className="text-xl">Deployment Is Starting</h1>
        <p className="mt-2 text-sm text-emerald-200/80">
          Runtime URL is not ready yet for /{deploymentSlug}. Reload in a few seconds.
        </p>
      </section>
    </div>
  );
}
