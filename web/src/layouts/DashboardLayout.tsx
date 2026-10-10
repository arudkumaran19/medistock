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
  Users,
  Truck,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Loader2,
  ArrowRightLeft,
  Clock,
} from "lucide-react";
import { useProcurementAgent } from "../context/ProcurementAgentContext";
import { NotificationBell } from "../features/redistribution/NotificationBell";

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
    group: "Redistribution",
    items: [
      {
        label: "Transfers",
        path: "/transfers",
        icon: <ArrowRightLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
      },
      {
        label: "Transfer History",
        path: "/history",
        icon: <Clock size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
      },
    ],
  },
  {
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
          width: "100%",
          padding: "6px 8px",
          background: open ? "rgba(255,255,255,0.06)" : "none",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 150ms ease",
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#f1f5f9",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email}
          </p>
          <span
            style={{
              display: "inline-block",
              fontSize: "0.6875rem",
              fontWeight: 500,
              color: roleAccent,
              margin: 0,
            }}
          >
            {roleLabel}
          </span>
        </div>
        <ChevronDown
          size={14}
          style={{
            color: "#64748b",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            padding: "4px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 100,
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
              {user.email}
            </p>
          </div>
          <button
            role="menuitem"
            onClick={onLogout}
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
      )}
    </div>
  );
}

// â”€â”€â”€ Sidebar Item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function NavLinkItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "7px 10px",
        borderRadius: "6px",
        fontSize: "0.875rem",
        fontWeight: isActive ? 600 : 400,
        color: isActive ? "#f8fafc" : "#94a3b8",
        background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
        textDecoration: "none",
        transition: "all 150ms ease",
        marginBottom: "2px",
      }}
    >
      <span style={{ color: isActive ? "#38bdf8" : "#64748b", display: "flex" }}>
        {item.icon}
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {isActive && (
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#38bdf8",
          }}
        />
      )}
    </Link>
  );
}

// â”€â”€â”€ DashboardLayout Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAgentLoading, agentElapsedSecs, getAgentPhase } = useProcurementAgent();

  const userRoles = user?.roles ?? [];

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function userHasRole(requiredRoles?: string[]): boolean {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return requiredRoles.some((r) => userRoles.includes(r));
  }

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => userHasRole(item.roles)),
  })).filter((g) => g.items.length > 0);

  function isActive(path: string): boolean {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    if (path === "/inventory") return location.pathname === "/inventory";
    if (path === "/transfers") return location.pathname === "/" || location.pathname.startsWith("/transfers");
    return location.pathname.startsWith(path);
  }

  const roleLabel = getRoleLabel(userRoles);
  const roleAccent = getRoleAccent(userRoles);

  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Brand */}
      <div
        style={{
          padding: "20px 16px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <Activity size={18} />
        </div>
        <div>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "-0.01em",
              display: "block",
            }}
          >
            MediStock
          </span>
          <span style={{ fontSize: "0.6875rem", color: "#64748b", display: "block" }}>
            Supply Chain Platform
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {visibleGroups.map((group) => (
          <div key={group.group} style={{ marginBottom: "16px" }}>
            <p
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: "0 0 6px 10px",
              }}
            >
              {group.group}
            </p>
            {group.items.map((item) => (
              <NavLinkItem
                key={item.path}
                item={item}
                isActive={isActive(item.path)}
                onClick={() => setMobileOpen(false)}
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
        {user ? (
          <ProfileDropdown
            user={user}
            roleLabel={roleLabel}
            roleAccent={roleAccent}
            onLogout={() => void handleLogout()}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px" }}>
            <Link to="/login" style={{ color: "#38bdf8", fontSize: "0.8125rem", textDecoration: "none" }}>
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {/* â”€â”€ Desktop Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              }}
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* â”€â”€ Main Area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBell />
          </div>
        </header>

        {/* Top desktop bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 32px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
              MediStock Core &amp; Redistribution Platform
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <NotificationBell />
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
        <main style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
          {children ?? <Outlet />}
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

export default DashboardLayout;
