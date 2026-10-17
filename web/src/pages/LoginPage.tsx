import React, { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Boxes,
  UserCheck,
} from "lucide-react";

/* ─── Official Brand Mark ────────────────────────────────────────── */
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="#0D9488" />
      <rect x="14" y="7" width="4" height="18" rx="2" fill="white" opacity="0.95" />
      <rect x="7" y="14" width="18" height="4" rx="2" fill="white" opacity="0.95" />
      <circle cx="23" cy="9" r="2.5" fill="white" opacity="0.8" />
    </svg>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please verify credentials.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleQuickFill(roleKey: string, demoEmail: string, demoPass: string) {
    setSelectedRole(roleKey);
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#0c1524",
        color: "#0f172a",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Left Visual Experience Column (Desktop) ── */}
      <div
        style={{
          flex: "1 1 52%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
          overflow: "hidden",
        }}
        className="login-hero-pane"
      >
        {/* Background Image with Rich Deep Cinema Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/images/pharmacy-shelves.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 35%",
            filter: "brightness(0.65) contrast(1.1)",
          }}
        />
        {/* Multi-layered clinical gradient overlay to ensure readable typography */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(12, 21, 36, 0.94) 0%, rgba(15, 118, 110, 0.72) 55%, rgba(9, 19, 28, 0.96) 100%)",
          }}
        />
        {/* Subtle grid mesh */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            pointerEvents: "none",
          }}
        />

        {/* Top Brand Emblem */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 14 }}>
          <BrandMark size={40} />
          <div>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "1.45rem",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.03em",
                display: "block",
                lineHeight: 1.15,
              }}
            >
              MediStock
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#99f6e4",
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
              }}
            >
              Clinical Intelligence Platform
            </span>
          </div>
        </div>

        {/* Center Clinical Value & Live Telemetry Widget */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: 560, margin: "auto 0", padding: "28px 0" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: "20px",
              background: "rgba(13, 148, 136, 0.2)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(45, 212, 191, 0.35)",
              color: "#ccfbf1",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            <ShieldCheck size={14} color="#2dd4bf" />
            Institutional Pharmaceutical Supply Chain
          </div>

          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "2.65rem",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.15,
              margin: "0 0 18px",
              letterSpacing: "-0.035em",
              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
            }}
          >
            Precision stock continuity for critical healthcare.
          </h2>

          <p
            style={{
              color: "#e2e8f0",
              fontSize: "1rem",
              lineHeight: 1.65,
              margin: "0 0 28px",
              maxWidth: 500,
            }}
          >
            Orchestrating hospital pharmacy inventories, automated shortage deficit prediction, multi-facility
            redistribution, and supplier procurement under strict clinical governance.
          </p>

          {/* Frosted Glass Live Telemetry Card */}
          <div
            style={{
              background: "rgba(16, 29, 43, 0.75)",
              backdropFilter: "blur(16px)",
              borderRadius: "14px",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              padding: "16px 20px",
              boxShadow: "0 16px 36px -10px rgba(0, 0, 0, 0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                paddingBottom: "10px",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#10b981",
                    boxShadow: "0 0 8px #10b981",
                  }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Live Network Telemetry
                </span>
              </div>
              <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                Active Session Encryption: AES-256
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginBottom: 2 }}>Connected Nodes</span>
                <strong style={{ fontSize: "1.125rem", color: "#ffffff", fontFamily: "'Space Grotesk', sans-serif" }}>12 Facilities</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginBottom: 2 }}>Cold-Chain Safety</span>
                <strong style={{ fontSize: "1.125rem", color: "#38bdf8", fontFamily: "'Space Grotesk', sans-serif" }}>100% Monitored</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginBottom: 2 }}>Audit Trail</span>
                <strong style={{ fontSize: "1.125rem", color: "#34d399", fontFamily: "'Space Grotesk', sans-serif" }}>GxP Verified</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Reassurance */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
            Protected by institutional authentication protocols. Authorized clinical staff only.
          </p>
          <span style={{ fontSize: "0.72rem", color: "#64748b" }}>ISO 27001 · NHS Digital Aligned</span>
        </div>
      </div>

      {/* ── Right Form Column: Elevated Premium SaaS Portal ── */}
      <div
        style={{
          flex: "1 1 48%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 32px",
          background: "linear-gradient(145deg, #f8fafc 0%, #edf2f7 100%)",
          position: "relative",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: "100%",
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 45px -12px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.05)",
            padding: "36px 36px 32px",
          }}
        >
          {/* Header with Security Gateway Indicator */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: "6px",
                background: "#f0fdfa",
                border: "1px solid #ccfbf1",
                color: "#0f766e",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              <Lock size={12} color="#0f766e" />
              Secure Hospital Gateway
            </div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontSize: "1.85rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 6px",
                letterSpacing: "-0.03em",
              }}
            >
              Sign in to MediStock
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0, lineHeight: 1.5 }}>
              Enter your institutional credentials to access inventory telemetry, redistribution, and procurement controls.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "0.8125rem",
                marginBottom: 20,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ lineHeight: 1.45 }}>{error}</span>
            </div>
          )}

          {/* Quick Demo Access: Interactive Role Selector Cards */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                One-Click Role Demonstration
              </span>
              <span style={{ fontSize: "0.7rem", color: "#0f766e", fontWeight: 600 }}>Click to auto-populate</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                {
                  id: "admin",
                  label: "Admin",
                  sub: "System Full Access",
                  email: "admin@medistock.com",
                  pass: "Admin123!",
                  icon: <ShieldCheck size={14} color="#0f766e" />,
                },
                {
                  id: "lead",
                  label: "Facility Lead",
                  sub: "Approver & Director",
                  email: "lead@medistock.com",
                  pass: "Admin123!",
                  icon: <UserCheck size={14} color="#0284c7" />,
                },
                {
                  id: "staff",
                  label: "Store Staff",
                  sub: "Inventory & Dispatch",
                  email: "staff@medistock.com",
                  pass: "Admin123!",
                  icon: <Boxes size={14} color="#d97706" />,
                },
              ].map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleQuickFill(role.id, role.email, role.pass)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "9px 10px",
                    borderRadius: "8px",
                    background: selectedRole === role.id ? "#f0fdfa" : "#f8fafc",
                    border: selectedRole === role.id ? "1.5px solid #0d9488" : "1px solid #e2e8f0",
                    boxShadow: selectedRole === role.id ? "0 0 0 2px rgba(13, 148, 136, 0.15)" : "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 140ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    {role.icon}
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a" }}>{role.label}</span>
                  </div>
                  <span style={{ fontSize: "0.6875rem", color: "#64748b", whiteSpace: "nowrap" }}>{role.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label
                htmlFor="staff-email"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 6,
                }}
              >
                Institutional Email Address
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="staff-email"
                  type="email"
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 14px 11px 40px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem",
                    outline: "none",
                    color: "#0f172a",
                    background: "#ffffff",
                    transition: "border-color 150ms ease, box-shadow 150ms ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#0d9488";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13, 148, 136, 0.18)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@medistock.com"
                />
                <Mail
                  size={17}
                  style={{
                    position: "absolute",
                    left: 13,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label
                  htmlFor="staff-password"
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Password
                </label>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 42px 11px 40px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem",
                    outline: "none",
                    color: "#0f172a",
                    background: "#ffffff",
                    transition: "border-color 150ms ease, box-shadow 150ms ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#0d9488";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13, 148, 136, 0.18)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
                <Lock
                  size={17}
                  style={{
                    position: "absolute",
                    left: 13,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    pointerEvents: "none",
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: 11,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: 4,
                    cursor: "pointer",
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 6,
                padding: "12px 20px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                color: "#ffffff",
                fontSize: "0.9375rem",
                fontWeight: 600,
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(13, 148, 136, 0.3)",
                transition: "all 150ms ease",
                opacity: isLoading ? 0.75 : 1,
              }}
            >
              {isLoading ? (
                <>Authenticating Institutional Credentials...</>
              ) : (
                <>
                  Sign In to Dashboard <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Registration & Support Links */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: "1px solid #f1f5f9",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
              Don't have an institutional staff account?{" "}
              <Link
                to="/register"
                style={{
                  color: "#0d9488",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Request Registration
              </Link>
            </span>
            <Link
              to="/"
              style={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                textDecoration: "none",
              }}
            >
              ← Back to MediStock Public Overview
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
