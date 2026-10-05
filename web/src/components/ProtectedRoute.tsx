import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "#0f766e", fontWeight: 600 }}>Verifying session credentials…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div style={{ padding: 48, maxWidth: 640, margin: "40px auto", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
        <h2 style={{ color: "#991b1b", margin: "0 0 12px 0" }}>403 — Unauthorized Access</h2>
        <p style={{ color: "#7f1d1d" }}>
          Your current account role does not possess permissions to access this screen. Contact your clinical facility administrator for elevated authorization.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
