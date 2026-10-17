import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { Lock } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  allowedRoles?: string[];
  forbiddenRoles?: string[];
  policyCheck?: (auth: ReturnType<typeof useAuth>) => boolean;
}

export function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
  forbiddenRoles,
  policyCheck,
}: ProtectedRouteProps) {
  const auth = useAuth();
  const { isAuthenticated, isLoading, hasRole, user } = auth;
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

  let isAuthorized = true;

  if (requiredRole && !hasRole(requiredRole)) {
    isAuthorized = false;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRoles = (user?.roles || []).map((r) => r.toLowerCase());
    const matchesAllowed = allowedRoles.some((r) => userRoles.includes(r.toLowerCase()));
    if (!matchesAllowed) {
      isAuthorized = false;
    }
  }

  if (forbiddenRoles && forbiddenRoles.length > 0) {
    const userRoles = (user?.roles || []).map((r) => r.toLowerCase());
    const matchesForbidden = forbiddenRoles.some((r) => userRoles.includes(r.toLowerCase()));
    if (matchesForbidden) {
      isAuthorized = false;
    }
  }

  if (policyCheck && !policyCheck(auth)) {
    isAuthorized = false;
  }

  if (!isAuthorized) {
    const roleList = (user?.roles || []).join(", ") || "No role assigned";
    return (
      <div
        style={{
          padding: 36,
          maxWidth: 580,
          margin: "48px auto",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #fed7aa",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.05)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#fff7ed",
            color: "#c2410c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
          }}
        >
          <Lock size={24} color="#c2410c" aria-hidden="true" />
        </div>
        <h2 style={{ color: "#9a3412", margin: "0 0 10px 0", fontSize: "1.25rem", fontWeight: 700 }}>
          Access Restricted
        </h2>
        <p style={{ color: "#475569", margin: "0 0 12px 0", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Your current account role (<strong>{roleList}</strong>) does not have permission to view or manage this section.
        </p>
        <p style={{ color: "#64748b", margin: "0 0 24px 0", fontSize: "0.8125rem", lineHeight: 1.5 }}>
          If your clinical or operational duties require access to this area, please contact your facility administrator or clinical IT lead to request elevated permissions.
        </p>
        <div>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "9px 18px",
              background: "#0f766e",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.875rem",
            }}
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
