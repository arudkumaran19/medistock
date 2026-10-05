import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  LayoutDashboard,
  Pill,
  PackagePlus,
  CalendarCheck,
  Building2,
  ClipboardList,
  Activity,
  AlertTriangle,
  TrendingUp,
  LineChart,
  BadgeCheck,
  GitBranch,
  User,
  Users,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Bell,
  Sparkles,
  ShieldCheck,
  Loader2,
  Truck,
} from "lucide-react";
import { useProcurementAgent } from "../context/ProcurementAgentContext";

// ─── Types ─────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

// ─── Navigation Definition ─────────────────────────────────────────────────

const ICON_SIZE = 16;
const ICON_STROKE = 1.75;

const NAV_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
      },
    ],
  },
  {
    group: "Inventory",
    items: [
      {
        label: "Inventory",
        path: "/inventory",
        icon: <Pill size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
      },
      {
        label: "Receive Stock",
        path: "/inventory/receive",
        icon: <PackagePlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["OperationalStaff", "STORE_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
      {
        label: "Expiry Monitor",
        path: "/inventory/expiry",
        icon: <CalendarCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["OperationalStaff", "STORE_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
    ],
  },
  {
    // Demand & Shortage vertical - Sathurstiga S. (IT24103156).
    // Roles mirror the [Authorize] attributes on DemandController and
    // ShortageController so the sidebar never offers a page the API refuses.
    group: "Demand & Shortage",
    items: [
      {
        label: "Shortages",
        path: "/demand/shortages",
        icon: <AlertTriangle size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["OperationalStaff", "STORE_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
      {
        label: "Forecasts",
        path: "/demand/forecasts",
        icon: <TrendingUp size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
      {
        label: "Consumption",
        path: "/demand/consumption",
        icon: <LineChart size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["OperationalStaff", "STORE_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
    ],
  },
  {
    // Redistribution vertical (Member 3). Store officers raise, dispatch and
    // receive transfers; managers approve. Mirrors TransferController roles.
    group: "Redistribution",
    items: [
      {
        label: "Transfers",
        path: "/redistribution/transfers",
        icon: <Truck size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["OperationalStaff", "STORE_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
    ],
  },
  {
    group: "Procurement",
    items: [
      {
        label: "Suppliers",
        path: "/procurement/suppliers",
        icon: <Building2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["SupplierOfficer", "SUPPLIER_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
      {
        label: "Purchase Orders",
        path: "/procurement/orders",
        icon: <ClipboardList size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["SupplierOfficer", "SUPPLIER_OFFICER", "FacilityManager", "FACILITY_MANAGER", "OperationalStaff", "STORE_OFFICER", "Administrator", "ADMIN"],
      },
      {
        label: "Priorities",
        path: "/procurement/priorities",
        icon: <Sparkles size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["SupplierOfficer", "SUPPLIER_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
      {
        label: "Approvals",
        path: "/procurement/approvals",
        icon: <BadgeCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
      {
        label: "Workflow",
        path: "/procurement/workflow",
        icon: <GitBranch size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["SupplierOfficer", "SUPPLIER_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
    ],
  },
  {
    group: "Administration",
    items: [
      {
        label: "User Management",
        path: "/admin/users",
        icon: <Users size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["Administrator", "ADMIN"],
      },
    ],
  },
];

// ─── Role helpers ───────────────────────────────────────────────────────────

function getRoleLabel(roles: string[]): string {
  if (roles.some((r) => ["Administrator", "ADMIN"].includes(r))) return "Administrator";
  if (roles.some((r) => ["FacilityManager", "FACILITY_MANAGER"].includes(r))) return "Facility Manager";
  if (roles.some((r) => ["SupplierOfficer", "SUPPLIER_OFFICER"].includes(r))) return "Supplier Officer";
  if (roles.some((r) => ["OperationalStaff", "STORE_OFFICER"].includes(r))) return "Operational Staff";
  return "Clinical Staff";
}

function getRoleAccent(roles: string[]): string {
  if (roles.some((r) => ["Administrator", "ADMIN"].includes(r))) return "#7c3aed";
  if (roles.some((r) => ["FacilityManager", "FACILITY_MANAGER"].includes(r))) return "#d97706";
  if (roles.some((r) => ["SupplierOfficer", "SUPPLIER_OFFICER"].includes(r))) return "#0d9488";
  return "#475569";
}

function getInitials(email: string): string {
  const parts = email.split("@")[0].split(/[._-]/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "U";
}

// ─── Profile Dropdown ───────────────────────────────────────────────────────

function ProfileDropdown({
  user,
  roleLabel,
  roleAccent,
  onLogout,
}: {
  user: { email: string; roles?: string[] };
  roleLabel: string;
  roleAccent: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = getInitials(user.email);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: "8px",
          transition: "background 150ms",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "none")}
      >
        {/* Avatar */}
        <div
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: roleAccent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ textAlign: "left", lineHeight: 1.3 }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
            {user.email.split("@")[0]}
          </p>
          <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: 0 }}>{roleLabel}</p>
        </div>
        <ChevronDown
          size={14}
          style={{
            color: "#64748b",
            transition: "transform 150ms",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            bottom: "calc(100% + 8px)",
            width: 240,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            overflow: "hidden",
            animation: "modalIn 150ms ease",
            zIndex: 300,
          }}
        >
          {/* User info */}
          <div style={{ padding: "16px", borderBottom: "1px solid #334155" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: roleAccent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
                  {user.email.split("@")[0]}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "2px 0 0" }}>
                  {user.email}
                </p>
              </div>
            </div>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                fontSize: "0.7rem",
                fontWeight: 600,
                background: `${roleAccent}22`,
                color: roleAccent,
                borderRadius: "9999px",
                border: `1px solid ${roleAccent}40`,
              }}
            >
              {roleLabel}
            </span>
          </div>

          {/* Menu items */}
          <div style={{ padding: "6px" }}>
            {[
              { icon: <User size={14} />, label: "Profile" },
              { icon: <ShieldCheck size={14} />, label: "Role Information" },
            ].map((item) => (
              <button
                key={item.label}
                role="menuitem"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "8px 10px",
                  background: "none",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                  color: "#cbd5e1",
                  textAlign: "left",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#334155")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "none")}
              >
                <span style={{ color: "#64748b" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #334155", padding: "6px" }}>
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                background: "none",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8125rem",
                color: "#f87171",
                textAlign: "left",
                transition: "background 150ms",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#3f1212")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "none")}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar Nav Item ───────────────────────────────────────────────────────

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      to={item.path}
      title={item.label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "7px 12px",
        fontSize: "0.8125rem",
        fontWeight: isActive ? 600 : 500,
        color: isActive ? "#f1f5f9" : "#94a3b8",
        textDecoration: "none",
        background: isActive ? "rgba(13, 148, 136, 0.18)" : "transparent",
        borderRadius: "6px",
        borderLeft: isActive ? "2px solid #2dd4bf" : "2px solid transparent",
        transition: "background 120ms, color 120ms",
        position: "relative",
        marginBottom: "1px",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "rgba(255,255,255,0.05)";
          el.style.color = "#e2e8f0";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "transparent";
          el.style.color = "#94a3b8";
        }
      }}
    >
      <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

// ─── Main Layout ────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLoading: isAgentLoading, elapsedSecs: agentElapsedSecs, getPhase: getAgentPhase } = useProcurementAgent();

  const userRoles = user?.roles ?? [];
  const roleLabel = getRoleLabel(userRoles);
  const roleAccent = getRoleAccent(userRoles);

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (item) => !item.roles || item.roles.some((r) => userRoles.includes(r))
    ),
  })).filter((g) => g.items.length > 0);

  function isActive(path: string) {
    if (path === "/inventory") return location.pathname === "/inventory";
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  // ── Sidebar inner ─────────────────────────────────────────────────────────
  const sidebarContent = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "0 16px",
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            background: "linear-gradient(135deg, #0d9488, #0f766e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Activity size={15} strokeWidth={2.5} style={{ color: "#fff" }} />
        </div>
        <Link
          to="/dashboard"
          style={{ textDecoration: "none" }}
          aria-label="MediStock Home"
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "1.0625rem",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "-0.02em",
            }}
          >
            MediStock
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Main navigation"
        style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}
      >
        {visibleGroups.map((group) => (
          <div key={group.group} style={{ marginBottom: "20px" }}>
            <p
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "0 12px",
                marginBottom: "4px",
              }}
            >
              {group.group}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                item={item}
                isActive={isActive(item.path)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "12px 8px",
          flexShrink: 0,
        }}
      >
        {user && (
          <ProfileDropdown
            user={user}
            roleLabel={roleLabel}
            roleAccent={roleAccent}
            onLogout={() => void handleLogout()}
          />
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <aside
        style={{
          width: 240,
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
        className="sidebar-desktop"
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile Sidebar Drawer ─────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.6)",
              zIndex: 299,
              animation: "overlayIn 150ms ease",
            }}
          />
          <aside
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              bottom: 0,
              width: 260,
              background: "#0f172a",
              zIndex: 300,
              display: "flex",
              flexDirection: "column",
              animation: "slideInLeft 200ms ease",
            }}
          >
            <button
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
              }}
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* ── Main Area ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile topbar */}
        <header
          className="mobile-topbar"
          style={{
            display: "none",
            alignItems: "center",
            gap: "12px",
            padding: "0 16px",
            height: 52,
            background: "#0f172a",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <button
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
            }}
          >
            <Menu size={20} />
          </button>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "#f1f5f9",
            }}
          >
            MediStock
          </span>
          <div style={{ marginLeft: "auto" }}>
            <Bell size={18} style={{ color: "#64748b" }} />
          </div>
        </header>

        {isAgentLoading && !location.pathname.includes("/procurement/priorities") && !location.pathname.includes("/procurement/suppliers") && (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: "linear-gradient(90deg, #042f2e 0%, #064e3b 100%)",
              borderBottom: "1px solid #0d9488",
              color: "#99f6e4",
              padding: "8px 24px",
              fontSize: "0.8125rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Loader2 size={15} className="spin" style={{ color: "#2dd4bf" }} />
              <span>
                <strong>Procurement AI Agent working ({agentElapsedSecs}s):</strong> {getAgentPhase().label}
              </span>
            </div>
            <Link
              to="/procurement/priorities"
              style={{
                color: "#5eead4",
                textDecoration: "underline",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              View Agent Panel &rarr;
            </Link>
          </div>
        )}

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
          {children}
        </main>
      </div>

      <style>{`
        @keyframes overlayIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-topbar { display: flex !important; }
          main { padding: 20px 16px !important; }
        }
        @media (max-width: 1024px) and (min-width: 769px) {
          main { padding: 24px 24px !important; }
        }
      `}</style>
    </div>
  );
}
