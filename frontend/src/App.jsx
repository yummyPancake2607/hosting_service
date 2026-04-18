import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import DeploymentDetailsPage from "./pages/DeploymentDetailsPage";
import DeploymentsListPage from "./pages/DeploymentsListPage";
import LogsPage from "./pages/LogsPage";
import LoginPage from "./pages/LoginPage";
import NewDeploymentPage from "./pages/NewDeploymentPage";
import NotFoundPage from "./pages/NotFoundPage";
import PublicDeploymentPage from "./pages/PublicDeploymentPage";
import SettingsPage from "./pages/SettingsPage";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="deployments" element={<DeploymentsListPage />} />
        <Route path="deployments/new" element={<NewDeploymentPage />} />
        <Route path="deployments/:id" element={<DeploymentDetailsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/:deploymentSlug" element={<PublicDeploymentPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
