import React, { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  UserPlus,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Boxes,
  User,
  Sparkles,
  Truck,
  Activity,
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

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your confirmation password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        role: "OperationalStaff",
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Institutional registration failed.");
    } finally {
      setIsLoading(false);
    }
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
      {/* ── Left Hero Pane: Logistics Photography & Clinical Value Proposition ── */}
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
            backgroundImage: "url('/images/medicine-logistics.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 40%",
            filter: "brightness(0.65) contrast(1.1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(12, 21, 36, 0.94) 0%, rgba(15, 118, 110, 0.72) 55%, rgba(9, 19, 28, 0.96) 100%)",
          }}
        />
        {/* Grid pattern */}
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

        {/* Center Clinical Messaging */}
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
            <Sparkles size={14} color="#2dd4bf" />
            Institutional Clinical Enrollment
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
            Unified inventory operations across every clinical ward.
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
            Join your hospital network's operational hub for automated batch traceability, verified stock reconciliation,
            and priority transfer execution under GxP regulatory compliance.
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
                  Staff Onboarding Standards
                </span>
              </div>
              <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                Multi-Factor Authorization
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginBottom: 2 }}>Role Governance</span>
                <strong style={{ fontSize: "1.125rem", color: "#ffffff", fontFamily: "'Space Grotesk', sans-serif" }}>Strict RBAC</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginBottom: 2 }}>Audit Readiness</span>
                <strong style={{ fontSize: "1.125rem", color: "#38bdf8", fontFamily: "'Space Grotesk', sans-serif" }}>100% Logged</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginBottom: 2 }}>Data Custody</span>
                <strong style={{ fontSize: "1.125rem", color: "#34d399", fontFamily: "'Space Grotesk', sans-serif" }}>Encrypted</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
            Institutional account requests require institutional supervisor confirmation.
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
          padding: "36px 32px",
          background: "linear-gradient(145deg, #f8fafc 0%, #edf2f7 100%)",
          position: "relative",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 45px -12px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.05)",
            padding: "36px 36px 30px",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 22 }}>
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
                marginBottom: 10,
              }}
            >
              <UserPlus size={12} color="#0f766e" />
              Staff Onboarding Portal
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
              Create Staff Account
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0, lineHeight: 1.5 }}>
              Register for institutional access to MediStock inventory telemetry and procurement.
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
                marginBottom: 18,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ lineHeight: 1.45 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* First & Last Name Dual Input */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label
                  htmlFor="reg-firstname"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 5,
                  }}
                >
                  First Name
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="reg-firstname"
                    type="text"
                    required
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px 10px 36px",
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
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Sarah"
                  />
                  <User
                    size={16}
                    style={{
                      position: "absolute",
                      left: 11,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-lastname"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 5,
                  }}
                >
                  Last Name
                </label>
                <input
                  id="reg-lastname"
                  type="text"
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
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
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Jenkins"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label
                htmlFor="reg-email"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 5,
                }}
              >
                Institutional Email Address
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="reg-email"
                  type="email"
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px 10px 38px",
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
                  placeholder="s.jenkins@hospital.nhs.uk"
                />
                <Mail
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="reg-password"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 5,
                }}
              >
                Password (min. 6 characters)
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 40px 10px 38px",
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
                  placeholder="Create secure password"
                />
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
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
                    right: 10,
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
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password with Live Visual Match Indicator */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <label
                  htmlFor="reg-confirm-password"
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Confirm Password
                </label>
                {passwordsMatch && (
                  <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                    <CheckCircle2 size={12} /> Passwords match
                  </span>
                )}
                {passwordMismatch && (
                  <span style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>
                    Passwords do not match
                  </span>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 40px 10px 38px",
                    borderRadius: "8px",
                    border: passwordMismatch ? "1px solid #ef4444" : passwordsMatch ? "1px solid #10b981" : "1px solid #cbd5e1",
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
                    e.currentTarget.style.borderColor = passwordMismatch ? "#ef4444" : passwordsMatch ? "#10b981" : "#cbd5e1";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                />
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    pointerEvents: "none",
                  }}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: 10,
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
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                <>Enrolling Institutional Account...</>
              ) : (
                <>
                  Register Clinical Staff Account <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Sign In & Back Links */}
          <div
            style={{
              marginTop: 22,
              paddingTop: 16,
              borderTop: "1px solid #f1f5f9",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
              Already registered with an active staff profile?{" "}
              <Link
                to="/login"
                style={{
                  color: "#0d9488",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign In to Facility
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

export default RegisterPage;
