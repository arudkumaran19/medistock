import React, { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import styles from "./procurement/ProcurementPages.module.css";
import { UserPlus, AlertCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter your password.");
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
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsLoading(false);
    }
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
          maxWidth: 480,
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-2xl, 16px)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
          padding: "36px 32px",
          border: "1px solid var(--border-color, #e2e8f0)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
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
            <UserPlus size={24} />
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
            Staff Registration
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "6px 0 0" }}>
            Enroll with authorized clinical staff credentials
          </p>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert" style={{ marginBottom: 16 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>First Name</label>
              <input
                type="text"
                required
                className={styles.formInput}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Sarah"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Last Name</label>
              <input
                type="text"
                required
                className={styles.formInput}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Connor"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Staff Email Address</label>
            <input
              type="email"
              required
              className={styles.formInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="s.connor@hospital.org"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password (min 6 characters)</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                className={styles.formInput}
                style={{ width: "100%", paddingRight: 40 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Confirm Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                className={styles.formInput}
                style={{ width: "100%", paddingRight: 40 }}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
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
                  borderRadius: 4,
                }}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              background: "#f0fdfa",
              border: "1px solid #ccfbf1",
              borderRadius: 8,
              fontSize: "0.78rem",
              color: "#0f766e",
              lineHeight: 1.4,
            }}
          >
            <ShieldCheck size={18} style={{ color: "#0f766e", flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Security Protocol:</strong> Self-registration automatically grants standard Operational Staff privileges. Managerial and administrative roles require authorization by system administrators.
            </div>
          </div>

          <button
            type="submit"
            className={styles.primaryButton}
            style={{ width: "100%", justifyContent: "center", height: 42, marginTop: 6 }}
            disabled={isLoading}
          >
            {isLoading ? "Creating Account…" : "Register Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: "0.875rem", color: "#64748b" }}>
          Already have an authorized staff account?{" "}
          <Link to="/login" style={{ color: "#0f766e", fontWeight: 600, textDecoration: "none" }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
