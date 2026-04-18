import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../components/context/UserContent";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { authLoading, isSignedIn, signInWithGoogle } = useUser();

  useEffect(() => {
    if (!authLoading && isSignedIn) {
      navigate("/");
    }
  }, [authLoading, isSignedIn, navigate]);

  return (
    <div className="login-container" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
      <main className="form-wrapper" style={{ height: "auto", width: "100%", maxWidth: "480px", paddingInline: "0.75rem" }}>
        <div className="form-container" style={{ maxWidth: "100%" }}>
          <div className="glass-panel">
            <h2 className="form-title">Sign In</h2>
            <p style={{ color: "#d1d5db", marginTop: 0 }}>
              Continue with Google to access your real profile and synced library.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => signInWithGoogle()}
            >
              Continue with Google
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
