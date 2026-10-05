import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../services/apiClient";
import { useAuth } from "../features/auth/AuthContext";
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
  Search,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  X,
  Crown,
  Shield,
  Briefcase,
  UserCog,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserDto {
  id: string;
  email: string;
  userName: string | null;
  roles: string[];
  isActive: boolean;
  lockoutEnd: string | null;
}

type CanonicalRole = "Administrator" | "FacilityManager" | "SupplierOfficer" | "OperationalStaff";

const ROLE_OPTIONS: { value: CanonicalRole; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { value: "Administrator",   label: "Administrator",     color: "#7c3aed", bg: "#4c1d9520", icon: <Crown size={13} /> },
  { value: "FacilityManager", label: "Facility Manager",  color: "#d97706", bg: "#78350f20", icon: <Shield size={13} /> },
  { value: "SupplierOfficer", label: "Supplier Officer",  color: "#0d9488", bg: "#042f2e20", icon: <Briefcase size={13} /> },
  { value: "OperationalStaff",label: "Operational Staff", color: "#475569", bg: "#1e293b20", icon: <UserCog size={13} /> },
];

function getCanonicalRole(roles: string[]): CanonicalRole {
  if (roles.some((r) => ["Administrator", "ADMIN"].includes(r)))           return "Administrator";
  if (roles.some((r) => ["FacilityManager", "FACILITY_MANAGER"].includes(r))) return "FacilityManager";
  if (roles.some((r) => ["SupplierOfficer", "SUPPLIER_OFFICER"].includes(r)))  return "SupplierOfficer";
  return "OperationalStaff";
}

function getRoleMeta(role: CanonicalRole) {
  return ROLE_OPTIONS.find((r) => r.value === role) ?? ROLE_OPTIONS[3];
}

// ─── Confirmation Modal ──────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        animation: "overlayIn 120ms ease",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 14,
          padding: "28px 32px",
          width: 420,
          maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          animation: "modalIn 150ms ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: danger ? "#3f121220" : "#042f2e20",
              border: `1px solid ${danger ? "#f8717140" : "#2dd4bf40"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {danger ? <AlertTriangle size={18} style={{ color: "#f87171" }} /> : <CheckCircle2 size={18} style={{ color: "#2dd4bf" }} />}
          </div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f1f5f9" }}>{title}</h3>
        </div>
        <p style={{ margin: "0 0 24px", fontSize: "0.875rem", color: "#94a3b8", lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px",
              background: "#334155",
              border: "none",
              borderRadius: 8,
              color: "#cbd5e1",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 18px",
              background: danger ? "#dc2626" : "#0d9488",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Role Selector Dropdown ──────────────────────────────────────────────────


function RoleSelector({
  currentRole,
  userId,
  isCurrentUser,
  onSelect,
}: {
  currentRole: CanonicalRole;
  userId: string;
  isCurrentUser: boolean;
  onSelect: (role: CanonicalRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const meta = getRoleMeta(currentRole);

  React.useEffect(() => {
    if (!open || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 210;
    const menuHeight = 220;
    const verticalGap = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenAbove = spaceBelow < menuHeight && spaceAbove > menuHeight;

    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - menuWidth - 12),
    );

    const top = shouldOpenAbove
      ? rect.top - menuHeight - verticalGap
      : rect.bottom + verticalGap;

    setMenuStyle({
      position: "fixed",
      top,
      left,
      width: menuWidth,
      zIndex: 9999,
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 10,
      boxShadow: "0 16px 40px rgba(15,23,42,0.45)",
      overflow: "hidden",
      animation: "modalIn 120ms ease",
    });
  }, [open, currentRole]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={buttonRef}
        id={`role-selector-${userId}`}
        disabled={isCurrentUser}
        onClick={() => setOpen((v) => !v)}
        title={isCurrentUser ? "Cannot change your own role" : "Change role"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px 4px 8px",
          background: meta.bg,
          color: meta.color,
          border: `1px solid ${meta.color}30`,
          borderRadius: 9999,
          fontSize: "0.7375rem",
          fontWeight: 600,
          cursor: isCurrentUser ? "not-allowed" : "pointer",
          opacity: isCurrentUser ? 0.6 : 1,
          transition: "opacity 150ms",
          position: "relative",
          zIndex: 1,
        }}
      >
        {meta.icon}
        {meta.label}
        {!isCurrentUser && <ChevronDown size={11} style={{ marginLeft: 2 }} />}
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
          <div style={menuStyle}>
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                id={`role-option-${userId}-${opt.value}`}
                onClick={() => { setOpen(false); if (opt.value !== currentRole) onSelect(opt.value); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "9px 14px",
                  background: opt.value === currentRole ? "#334155" : "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: opt.value === currentRole ? opt.color : "#cbd5e1",
                  textAlign: "left",
                  transition: "background 120ms",
                }}
                onMouseEnter={(e) => { if (opt.value !== currentRole) (e.currentTarget as HTMLElement).style.background = "#0f172a"; }}
                onMouseLeave={(e) => { if (opt.value !== currentRole) (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                <span style={{ color: opt.color }}>{opt.icon}</span>
                {opt.label}
                {opt.value === currentRole && (
                  <CheckCircle2 size={12} style={{ marginLeft: "auto", color: opt.color }} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; kind: "success" | "error" }

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, kind: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, show };
}

function ToastList({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 600,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: t.kind === "success" ? "#042f2e" : "#3f1212",
            border: `1px solid ${t.kind === "success" ? "#0d9488" : "#dc2626"}`,
            borderRadius: 10,
            color: t.kind === "success" ? "#99f6e4" : "#fca5a5",
            fontSize: "0.8125rem",
            fontWeight: 500,
            minWidth: 280,
            maxWidth: 400,
            boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
            animation: "toastIn 200ms ease",
          }}
        >
          {t.kind === "success"
            ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            : <AlertTriangle size={16} style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toasts, show: showToast } = useToasts();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<CanonicalRole | "All">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [confirm, setConfirm] = useState<null | {
    title: string; message: string; danger: boolean; onConfirm: () => void;
  }>(null);

  const isAdmin = currentUser?.roles?.some((r) => ["Administrator", "ADMIN"].includes(r)) ?? false;

  // ── Fetch users ───────────────────────────────────────────────────────────
  const { data: users = [], isLoading, error, refetch, isFetching } = useQuery<UserDto[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiRequest<UserDto[]>("/api/users"),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: CanonicalRole }) =>
      apiRequest(`/api/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showToast(`Role updated to ${getRoleMeta(vars.role).label}`, "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showToast(vars.isActive ? "Account reactivated" : "Account deactivated", "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showToast("User permanently deleted", "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const matchSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.userName ?? "").toLowerCase().includes(search.toLowerCase());
    const canon = getCanonicalRole(u.roles);
    const matchRole = roleFilter === "All" || canon === roleFilter;
    const matchStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && u.isActive) ||
      (statusFilter === "Inactive" && !u.isActive);
    return matchSearch && matchRole && matchStatus;
  });

  const dismissToast = (id: number) => {
    // managed in useToasts timeout, no-op for manual dismiss
    void id;
  };

  // ── Role change handler ───────────────────────────────────────────────────
  function handleRoleChange(userId: string, email: string, newRole: CanonicalRole) {
    setConfirm({
      title: "Change User Role",
      message: `Change ${email}'s role to "${getRoleMeta(newRole).label}"? This takes effect immediately.`,
      danger: false,
      onConfirm: () => {
        setConfirm(null);
        roleMutation.mutate({ id: userId, role: newRole });
      },
    });
  }

  function handleStatusToggle(u: UserDto) {
    const action = u.isActive ? "deactivate" : "reactivate";
    setConfirm({
      title: u.isActive ? "Deactivate Account" : "Reactivate Account",
      message: `Are you sure you want to ${action} ${u.email}? ${u.isActive ? "The user will be immediately locked out." : ""}`,
      danger: !u.isActive ? false : true,
      onConfirm: () => {
        setConfirm(null);
        statusMutation.mutate({ id: u.id, isActive: !u.isActive });
      },
    });
  }

  function handleDelete(u: UserDto) {
    setConfirm({
      title: "Delete User",
      message: `Permanently delete ${u.email}? This cannot be undone. Users with approved purchase orders cannot be deleted.`,
      danger: true,
      onConfirm: () => {
        setConfirm(null);
        deleteMutation.mutate(u.id);
      },
    });
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    admins: users.filter((u) => getCanonicalRole(u.roles) === "Administrator").length,
    inactive: users.filter((u) => !u.isActive).length,
  };

  if (!isAdmin) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
          gap: 16,
          color: "#64748b",
        }}
      >
        <ShieldCheck size={48} style={{ color: "#334155" }} />
        <h2 style={{ margin: 0, color: "#0f172a", fontWeight: 700 }}>Access Denied</h2>
        <p style={{ margin: 0, fontSize: "0.9rem" }}>
          You must be an Administrator to access User Management.
        </p>
      </div>
    );
  }

  return (
    <>
      <ToastList toasts={toasts} dismiss={dismissToast} />
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={18} style={{ color: "#fff" }} />
              </div>
              <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                User Management
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              Manage system users, roles, and account status
            </p>
          </div>
          <button
            id="refresh-users-btn"
            onClick={() => void refetch()}
            disabled={isFetching}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 16px",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              color: "#475569",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: isFetching ? "not-allowed" : "pointer",
              opacity: isFetching ? 0.7 : 1,
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => { if (!isFetching) (e.currentTarget as HTMLElement).style.background = "#e2e8f0"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#f1f5f9"; }}
          >
            <RefreshCw size={14} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total Users",   value: stats.total,    color: "#7c3aed", bg: "#7c3aed10", icon: <Users size={18} /> },
          { label: "Active",        value: stats.active,   color: "#16a34a", bg: "#16a34a10", icon: <UserCheck size={18} /> },
          { label: "Administrators",value: stats.admins,   color: "#d97706", bg: "#d9770610", icon: <Crown size={18} /> },
          { label: "Inactive",      value: stats.inactive, color: "#dc2626", bg: "#dc262610", icon: <UserX size={18} /> },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: s.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: s.color,
                flexShrink: 0,
              }}
            >
              {s.icon}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "1.375rem", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                {isLoading ? "–" : s.value}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "14px 20px",
          marginBottom: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }}
          />
          <input
            id="user-search"
            type="text"
            placeholder="Search by email or username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: "0.8125rem",
              color: "#0f172a",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Role filter */}
        <select
          id="role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as CanonicalRole | "All")}
          style={{
            padding: "8px 12px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: "0.8125rem",
            color: "#475569",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="All">All Roles</option>
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        {/* Status filter */}
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "All" | "Active" | "Inactive")}
          style={{
            padding: "8px 12px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: "0.8125rem",
            color: "#475569",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <span style={{ fontSize: "0.8rem", color: "#94a3b8", marginLeft: "auto" }}>
          {filtered.length} of {users.length} users
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          overflow: "visible",
          position: "relative",
          zIndex: 1,
        }}
      >
        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: "#64748b", fontSize: "0.875rem" }}>
            <RefreshCw size={18} className="spin" />
            Loading users…
          </div>
        ) : error ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: "#f87171", fontSize: "0.875rem" }}>
            <AlertTriangle size={18} />
            {(error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 8, color: "#64748b" }}>
            <Users size={36} style={{ opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: "0.875rem" }}>No users found matching your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "visible", position: "relative", zIndex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  {["User", "Role", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 20px",
                        textAlign: "left",
                        fontSize: "0.7375rem",
                        fontWeight: 700,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => {
                  const canon = getCanonicalRole(u.roles);
                  const isSelf = u.id === currentUser?.userId;

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: idx < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                        transition: "background 100ms",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                    >
                      {/* User info */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: getRoleMeta(canon).color + "22",
                              border: `1.5px solid ${getRoleMeta(canon).color}40`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: getRoleMeta(canon).color,
                              flexShrink: 0,
                            }}
                          >
                            {u.email.split("@")[0].slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>
                              {u.email}
                              {isSelf && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    padding: "1px 7px",
                                    background: "#7c3aed20",
                                    color: "#7c3aed",
                                    borderRadius: 9999,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  YOU
                                </span>
                              )}
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
                              {u.userName ?? u.email.split("@")[0]}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role selector */}
                      <td style={{ padding: "14px 20px" }}>
                        <RoleSelector
                          currentRole={canon}
                          userId={u.id}
                          isCurrentUser={isSelf}
                          onSelect={(role) => handleRoleChange(u.id, u.email, role)}
                        />
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 20px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "3px 10px",
                            background: u.isActive ? "#16a34a15" : "#dc262615",
                            color: u.isActive ? "#16a34a" : "#dc2626",
                            border: `1px solid ${u.isActive ? "#16a34a30" : "#dc262630"}`,
                            borderRadius: 9999,
                            fontSize: "0.7375rem",
                            fontWeight: 600,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: u.isActive ? "#16a34a" : "#dc2626",
                            }}
                          />
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {/* Activate / Deactivate */}
                          <button
                            id={`toggle-status-${u.id}`}
                            disabled={isSelf || statusMutation.isPending}
                            onClick={() => handleStatusToggle(u)}
                            title={isSelf ? "Cannot change own account" : u.isActive ? "Deactivate account" : "Reactivate account"}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 12px",
                              background: u.isActive ? "#fef3c7" : "#dcfce7",
                              border: `1px solid ${u.isActive ? "#fbbf2440" : "#16a34a40"}`,
                              borderRadius: 7,
                              color: u.isActive ? "#d97706" : "#16a34a",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: isSelf ? "not-allowed" : "pointer",
                              opacity: isSelf ? 0.5 : 1,
                              transition: "opacity 120ms",
                            }}
                          >
                            {u.isActive
                              ? <><UserX size={13} /> Deactivate</>
                              : <><UserCheck size={13} /> Activate</>}
                          </button>

                          {/* Delete */}
                          <button
                            id={`delete-user-${u.id}`}
                            disabled={isSelf || deleteMutation.isPending}
                            onClick={() => handleDelete(u)}
                            title={isSelf ? "Cannot delete own account" : "Permanently delete user"}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 10px",
                              background: "#fef2f2",
                              border: "1px solid #fca5a540",
                              borderRadius: 7,
                              color: "#dc2626",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: isSelf ? "not-allowed" : "pointer",
                              opacity: isSelf ? 0.5 : 1,
                              transition: "opacity 120ms, background 120ms",
                            }}
                            onMouseEnter={(e) => { if (!isSelf) (e.currentTarget as HTMLElement).style.background = "#fee2e2"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes overlayIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
