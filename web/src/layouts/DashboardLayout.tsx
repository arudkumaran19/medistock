import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
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
  Sparkles,
  Loader2,
  Truck,
  ArrowRightLeft,
  Clock,
  ShieldCheck,
  BrainCircuit,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useProcurementAgent } from "../features/procurement/ProcurementAgentContext";
import { FloatingAIAssistant } from "../features/coordinator/FloatingAIAssistant";
import { NotificationBell } from "../features/notifications/NotificationBell";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Navigation Definition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        roles: ["OperationalStaff", "STORE_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
      {
        label: "Receive Stock",
        path: "/inventory/receive",
        icon: <PackagePlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["OperationalStaff", "STORE_OFFICER", "Administrator", "ADMIN"],
      },
      {
        label: "Expiry Monitor",
        path: "/inventory/expiry",
        icon: <CalendarCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["OperationalStaff", "STORE_OFFICER", "StoreOfficer", "StoreOperator", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
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
    group: "Redistribution",
    items: [
      {
        label: "Transfers",
        path: "/transfers",
        icon: <ArrowRightLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["OperationalStaff", "STORE_OFFICER", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
      },
      {
        label: "Transfer History",
        path: "/history",
        icon: <Clock size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
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
    group: "AI Coordination",
    items: [
      {
        label: "Coordinator Console",
        path: "/coordinator",
        icon: <BrainCircuit size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["SupplierOfficer", "SUPPLIER_OFFICER", "OperationalStaff", "STORE_OFFICER", "StoreOfficer", "StoreOperator", "FacilityManager", "FACILITY_MANAGER", "Administrator", "ADMIN"],
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
      {
        label: "Audit Logs",
        path: "/admin/audit-logs",
        icon: <ShieldCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        roles: ["Administrator", "ADMIN"],
      },
    ],
  },
];

// â”€â”€â”€ Role helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Profile Dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ProfileDropdown({
  user,
  roleLabel,
  roleAccent,
  onLogout,
  isCollapsed = false,
}: {
  user: { email: string; roles?: string[]; facilities?: { id: string; name: string }[] };
  roleLabel: string;
  roleAccent: string;
  onLogout: () => void;
  isCollapsed?: boolean;
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
        aria-label={`User menu for ${user.email} (${roleLabel})`}
        title={isCollapsed ? `${user.email} (${roleLabel})` : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: isCollapsed ? 0 : "8px",
          width: "100%",
          background: "none",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          padding: isCollapsed ? "4px 0" : "4px 8px",
          transition: "background 150ms",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: roleAccent,
            color: "#fff",
            fontSize: "0.6875rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </span>
        {!isCollapsed && (
          <>
            <div style={{ textAlign: "left", lineHeight: 1.3, minWidth: 0 }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f1f5f9", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                marginLeft: "auto",
              }}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "fixed",
            left: isCollapsed ? "calc(64px + 8px)" : "calc(240px - 244px)",
            bottom: isCollapsed ? "auto" : "32px",
            top: isCollapsed ? "auto" : "auto",
            width: 240,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            overflow: "hidden",
            zIndex: 9999,
            opacity: 1,
          }}
        >
          <div
            style={{
              padding: "6px 8px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              marginBottom: 4,
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>Signed in as</p>
            <p
              style={{
                margin: 0,
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#e2e8f0",
                wordBreak: "break-all",
              }}
            >
              {user.email || "Not available"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
              Role: <span style={{ color: roleAccent, fontWeight: 500 }}>{roleLabel || "Not available"}</span>
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
              Facility: <span style={{ color: "#e2e8f0" }}>{user.facilities && user.facilities.length > 0 ? user.facilities.map((f) => f.name).join(", ") : "Not available"}</span>
            </p>
          </div>

          <div style={{ padding: "6px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
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
              >
                <span style={{ color: "#64748b" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6px" }}>
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 8px",
                background: "none",
                border: "none",
                borderRadius: "4px",
                color: "#f87171",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
              }}
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

// â”€â”€â”€ Sidebar Item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function NavLink({
  item,
  isActive,
  isCollapsed = false,
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed?: boolean;
}) {
  return (
    <Link
      to={item.path}
      title={item.label}
      aria-label={item.label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        gap: isCollapsed ? 0 : "10px",
        padding: isCollapsed ? "8px 0" : "7px 12px",
        fontSize: "0.8125rem",
        fontWeight: isActive ? 600 : 500,
        color: isActive ? "#f1f5f9" : "#94a3b8",
        textDecoration: "none",
        background: isActive ? "rgba(13, 148, 136, 0.18)" : "transparent",
        borderRadius: "6px",
        borderLeft: isCollapsed ? "none" : (isActive ? "2px solid #2dd4bf" : "2px solid transparent"),
        boxShadow: isCollapsed && isActive ? "inset 0 0 0 1.5px #2dd4bf" : "none",
        transition: "background 120ms, color 120ms",
        position: "relative",
        marginBottom: "2px",
        width: isCollapsed ? 42 : "auto",
        margin: isCollapsed ? "0 auto 2px auto" : "0 0 1px 0",
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
      <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {item.icon}
      </span>
      {!isCollapsed && <span>{item.label}</span>}
    </Link>
  );
}

// â”€â”€â”€ DashboardLayout Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("medistock_global_sidebar_collapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < 1024;
  });
  const { isLoading: isAgentLoading, elapsedSecs: agentElapsedSecs, getPhase: getAgentPhase } = useProcurementAgent();

  const userRoles = user?.roles ?? [];
  const roleLabel = getRoleLabel(userRoles);
  const roleAccent = getRoleAccent(userRoles);

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      return !item.roles || item.roles.some((r) => userRoles.includes(r));
    }),
  })).filter((g) => g.items.length > 0);

  function isActive(path: string) {
    if (path === "/inventory") return location.pathname === "/inventory";
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  }

  function toggleSidebarCollapse() {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("medistock_global_sidebar_collapsed", String(next));
      return next;
    });
  }

  // Dismiss mobile drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  // ── Render Sidebar helper ──────────────────────────────────────────────────
  function renderSidebar(isCollapsed: boolean, isMobileView: boolean) {
    return (
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
            padding: isCollapsed ? "0 10px" : "0 16px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            gap: "8px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <Link
            to="/dashboard"
            style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}
            aria-label="MediStock Home"
            title="MediStock Home"
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
            {!isCollapsed && (
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
            )}
          </Link>

          {!isMobileView && !isCollapsed && (
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              aria-label="Collapse navigation sidebar"
              title="Collapse navigation sidebar"
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 5,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 150ms, color 150ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* Collapsed Rail Toggle Button */}
        {!isMobileView && isCollapsed && (
          <div
            style={{
              padding: "6px 0",
              display: "flex",
              justifyContent: "center",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              aria-label="Expand navigation sidebar"
              title="Expand navigation sidebar"
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 6,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 150ms, color 150ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <PanelLeft size={16} />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav
          aria-label="Main navigation"
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: isCollapsed ? "10px 4px" : "12px 8px" }}
        >
          {visibleGroups.map((group, gIdx) => (
            <div key={group.group} style={{ marginBottom: isCollapsed ? "14px" : "20px" }}>
              {!isCollapsed ? (
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
              ) : (
                gIdx > 0 && (
                  <div
                    style={{
                      height: 1,
                      background: "rgba(255,255,255,0.08)",
                      margin: "8px 10px",
                    }}
                    title={group.group}
                  />
                )
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  item={item}
                  isActive={isActive(item.path)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: isCollapsed ? "10px 4px" : "12px 8px",
            flexShrink: 0,
          }}
        >
          {user && (
            <ProfileDropdown
              user={user}
              roleLabel={roleLabel}
              roleAccent={roleAccent}
              onLogout={() => void handleLogout()}
              isCollapsed={isCollapsed}
            />
          )}
        </div>
      </div>
    );
  }

  const isCoordinator = location.pathname.startsWith("/coordinator");

  return (
    <div
      style={{
        display: "flex",
        height: isCoordinator ? "100vh" : undefined,
        maxHeight: isCoordinator ? "100vh" : undefined,
        minHeight: isCoordinator ? undefined : "100vh",
        overflow: isCoordinator ? "hidden" : undefined,
        background: "#f8fafc",
      }}
    >
      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <aside
        style={{
          width: isSidebarCollapsed ? 64 : 240,
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 40,
          overflowX: "hidden",
        }}
        className="sidebar-desktop"
      >
        {renderSidebar(isSidebarCollapsed, false)}
      </aside>

      {/* â”€â”€ Mobile Sidebar Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                zIndex: 10,
              }}
            >
              <X size={18} />
            </button>
            {renderSidebar(false, true)}
          </aside>
        </>
      )}

      {/* ── Main Area ─────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: isCoordinator ? "100vh" : undefined,
          maxHeight: isCoordinator ? "100vh" : undefined,
          overflow: isCoordinator ? "hidden" : undefined,
        }}
      >
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
            <NotificationBell theme="dark" />
          </div>
        </header>

        {/* Desktop topbar */}
        {!isCoordinator && (
          <header
            className="desktop-topbar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 32px",
              height: 52,
              background: "#ffffff",
              borderBottom: "1px solid #e2e8f0",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#10b981",
                    display: "inline-block",
                  }}
                />
                National Healthcare Supply Network
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <NotificationBell theme="light" />
            </div>
          </header>
        )}

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
                <strong>Procurement AI Agent working ({agentElapsedSecs}s):</strong> {getAgentPhase?.()?.label ?? 'Working...'}
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
        <main
          className={isCoordinator ? "coordinator-main" : "dashboard-main"}
          style={{
            flex: 1,
            height: isCoordinator ? "100%" : undefined,
            maxHeight: isCoordinator ? "100%" : undefined,
            overflow: isCoordinator ? "hidden" : "auto",
            padding: isCoordinator ? "0" : "28px 32px",
            display: isCoordinator ? "flex" : undefined,
            flexDirection: isCoordinator ? "column" : undefined,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {children}
        </main>
      </div>

      {/* Floating MediStock AI Assistant (hidden on /coordinator to prevent overlapping the main console) */}
      {!location.pathname.startsWith("/coordinator") && <FloatingAIAssistant />}

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
          .desktop-topbar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          main.dashboard-main { padding: 20px 16px !important; }
        }
        @media (max-width: 1024px) and (min-width: 769px) {
          main.dashboard-main { padding: 24px 24px !important; }
        }
      `}</style>
    </div>
  );
}

export default DashboardLayout;
