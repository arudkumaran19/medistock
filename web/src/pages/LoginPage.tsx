import React, { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import styles from "./procurement/ProcurementPages.module.css";
import { Pill, Mail, Lock, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("manager@medistock.com");
  const [password, setPassword] = useState("Password123!");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function applyPreset(presetEmail: string) {
    setEmail(presetEmail);
    setPassword("Password123!");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-2xl, 16px)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
          padding: "36px 32px",
          border: "1px solid var(--border-color, #e2e8f0)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #0f766e, #0d9488)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              marginBottom: 12,
              boxShadow: "0 4px 10px rgba(15, 118, 110, 0.25)",
            }}
          >
            <Pill size={26} />
          </div>
          <p className={styles.eyebrow} style={{ margin: "0 0 2px" }}>
            Healthcare Operations & Supply Chain
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#0f172a",
              margin: 0,
            }}
          >
            MediStock Portal
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "6px 0 0" }}>
            Sign in with authorized healthcare credentials
          </p>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Staff Email Address</label>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                required
                className={styles.formInput}
                style={{ width: "100%", paddingLeft: 38 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@medistock.com"
              />
              <Mail
                size={16}
                style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8", pointerEvents: "none" }}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                className={styles.formInput}
                style={{ width: "100%", paddingLeft: 38, paddingRight: 40 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <Lock
                size={16}
                style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8", pointerEvents: "none" }}
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
                  borderRadius: 4,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.primaryButton}
            style={{ width: "100%", justifyContent: "center", height: 42, marginTop: 6 }}
            disabled={isLoading}
          >
            {isLoading ? "Authenticating…" : "Sign In to Portal"}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: "0.875rem", color: "#64748b" }}>
          New clinical staff?{" "}
          <Link to="/register" style={{ color: "#0f766e", fontWeight: 600, textDecoration: "none" }}>
            Register an Account
          </Link>
        </div>

        {/* Quick Demo Role Selector Pills */}
        <div
          style={{
            marginTop: 24,
            padding: "14px 16px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            fontSize: "0.75rem",
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontWeight: 600, color: "#334155" }}>
            <ShieldCheck size={14} style={{ color: "#0f766e" }} />
            Quick Demo Logins:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              type="button"
              onClick={() => applyPreset("admin@medistock.com")}
              style={{
                background: email === "admin@medistock.com" ? "#ede9fe" : "#ffffff",
                border: "1px solid #cbd5e1",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                color: "#7c3aed",
                fontWeight: 600,
              }}
            >
              Administrator
            </button>
            <button
              type="button"
              onClick={() => applyPreset("manager@medistock.com")}
              style={{
                background: email === "manager@medistock.com" ? "#ccfbf1" : "#ffffff",
                border: "1px solid #cbd5e1",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                color: "#0f766e",
                fontWeight: 600,
              }}
            >
              Facility Manager
            </button>
            <button
              type="button"
              onClick={() => applyPreset("supplier@medistock.com")}
              style={{
                background: email === "supplier@medistock.com" ? "#ccfbf1" : "#ffffff",
                border: "1px solid #cbd5e1",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                color: "#0f766e",
                fontWeight: 600,
              }}
            >
              Supplier Officer
            </button>
            <button
              type="button"
              onClick={() => applyPreset("store@medistock.com")}
              style={{
                background: email === "store@medistock.com" ? "#ccfbf1" : "#ffffff",
                border: "1px solid #cbd5e1",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                color: "#0f766e",
                fontWeight: 600,
              }}
            >
              Store Officer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
