import { createContext, useContext, useMemo, useState } from "react";

import api from "../services/api";

const STORAGE_KEY = "crisperhost_auth";
const AuthContext = createContext(null);

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.username) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(loadStoredAuth);

  const login = async (credentials) => {
    const response = await api.login(credentials);
    const nextState = {
      token: response.access_token,
      username: response.username,
    };

    setAuthState(nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return response;
  };

  const logout = () => {
    setAuthState(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      token: authState?.token ?? null,
      username: authState?.username ?? null,
      isAuthenticated: Boolean(authState?.token),
      login,
      logout,
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
