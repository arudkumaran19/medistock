import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { PageHeader, KPICard } from "../components/ui";
import { inventoryApi } from "../services/inventoryApi";
import type { Batch, Facility } from "../types/inventory";
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Eye,
  Search,
  RotateCcw,
  PackageX,
  Activity,
  Calendar,
} from "lucide-react";

export function ExpiryPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [days, setDays] = useState(90);
  const [query, setQuery] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const requestKey = `${days}:${requestVersion}`;
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [requestError, setRequestError] = useState<{ key: string; message: string }>();
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    Promise.all([inventoryApi.expiring(days), inventoryApi.facilities()])
      .then(([rows, locations]) => {
        if (!cancelled) {
          setBatches(rows);
          setFacilities(locations);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setRequestError({ key: requestKey, message: e.message });
      })
      .finally(() => {
        if (!cancelled) setLoadedRequestKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [days, requestKey]);

  const isLoading = loadedRequestKey !== requestKey;
  const error = requestError?.key === requestKey ? requestError.message : "";
  const visible = useMemo(
    () =>
      batches.filter((x) =>
        `${x.medicineName} ${x.batchNumber}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [batches, query]
  );
  const critical = batches.filter((x) => new Date(x.expiryDateUtc).getTime() < now).length;
  const expiringSoon = batches.filter((x) => {
    const ms = new Date(x.expiryDateUtc).getTime() - now;
    return ms > 0 && ms <= 30 * 86400000;
  }).length;

  return (
    <DashboardLayout>
      <div className="page-container">
        {/* Back link */}
        <div style={{ marginBottom: 8 }}>
          <Link
            to="/inventory"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-sm, 13px)",
              color: "var(--color-primary-700, #0f766e)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Back to inventory
          </Link>
        </div>

        <PageHeader
          eyebrow="Batch Risk Monitoring"
          title="Expiry Watch"
          subtitle="Review active batches by expiry date. Retire unusable stock through the audited batch action."
        />

        {/* KPI Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KPICard
            label="Within Window"
            value={isLoading ? "—" : batches.length}
            context="Batches in selected range"
            icon={<Activity size={20} />}
            accent="#6366f1"
          />
          <KPICard
            label="Expiring Soon"
            value={isLoading ? "—" : expiringSoon}
            context="Within 30 days"
            icon={<Calendar size={20} />}
            accent="#d97706"
            variant={expiringSoon > 0 ? "warning" : "default"}
          />
          <KPICard
            label="Already Expired"
            value={isLoading ? "—" : critical}
            context="Requires immediate action"
            icon={<PackageX size={20} />}
            accent="#dc2626"
            variant={critical > 0 ? "danger" : "default"}
          />
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 24,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
            <label
              style={{
                fontSize: "var(--text-xs, 12px)",
                fontWeight: 600,
                color: "var(--text-secondary, #64748b)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Expiry window
            </label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{
                height: 40,
                padding: "0 12px",
                border: "1px solid var(--border-base, #e2e8f0)",
                borderRadius: "var(--radius-md, 8px)",
                fontSize: "var(--text-sm, 13px)",
                background: "#fff",
                color: "var(--text-primary, #0f172a)",
                cursor: "pointer",
              }}
            >
              <option value={30}>Next 30 days</option>
              <option value={90}>Next 90 days</option>
              <option value={180}>Next 180 days</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 240 }}>
            <label
              style={{
                fontSize: "var(--text-xs, 12px)",
                fontWeight: 600,
                color: "var(--text-secondary, #64748b)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Search batches
            </label>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted, #94a3b8)",
                }}
              />
              <input
                type="search"
                placeholder="Search medicine name or batch number..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px 0 38px",
                  border: "1px solid var(--border-base, #e2e8f0)",
                  borderRadius: "var(--radius-md, 8px)",
                  fontSize: "var(--text-sm, 13px)",
                  background: "#fff",
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRequestVersion((v) => v + 1)}
            style={{
              height: 40,
              padding: "0 16px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--border-base, #e2e8f0)",
              borderRadius: "var(--radius-md, 8px)",
              background: "#fff",
              fontSize: "var(--text-sm, 13px)",
              fontWeight: 600,
              color: "var(--text-secondary, #64748b)",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} /> Refresh
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
            <div className="spinner mb-3" style={{ margin: "0 auto" }} />
            <p role="status">Loading expiry data…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 18px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "var(--radius-lg, 10px)",
              color: "#b91c1c",
              marginBottom: 24,
              fontSize: "var(--text-sm, 13px)",
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              onClick={() => setRequestVersion((v) => v + 1)}
              type="button"
              style={{
                marginLeft: "auto",
                padding: "4px 12px",
                background: "#fff",
                border: "1px solid #fca5a5",
                borderRadius: "6px",
                color: "#b91c1c",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && visible.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--surface-card, #ffffff)",
              border: "1px solid var(--border-base, #e2e8f0)",
              borderRadius: "var(--radius-xl, 12px)",
              color: "var(--text-secondary, #64748b)",
            }}
          >
            <AlertTriangle size={36} style={{ margin: "0 auto 12px", color: "#cbd5e1" }} />
            <p style={{ margin: 0, fontWeight: 500 }}>
              No active batches match this expiry window and search.
            </p>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && visible.length > 0 && (
          <div
            style={{
              background: "var(--surface-card, #ffffff)",
              border: "1px solid var(--border-base, #e2e8f0)",
              borderRadius: "var(--radius-xl, 12px)",
              overflow: "hidden",
              boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm, 13px)" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-base, #e2e8f0)" }}>
                    {["Medicine", "Batch", "Facility", "Quantity", "Expires", "Alert Level", "Action"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontSize: "var(--text-xs, 11px)",
                          fontWeight: 600,
                          color: "var(--text-muted, #94a3b8)",
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
                  {visible.map((batch, idx) => {
                    const expired = new Date(batch.expiryDateUtc).getTime() < now;
                    const daysLeft = Math.ceil(
                      (new Date(batch.expiryDateUtc).getTime() - now) / 86400000
                    );
                    const badgeStyle: React.CSSProperties = expired
                      ? { background: "#fee2e2", color: "#b91c1c" }
                      : daysLeft <= 30
                      ? { background: "#fef3c7", color: "#b45309" }
                      : { background: "#dcfce7", color: "#15803d" };

                    return (
                      <tr
                        key={batch.id}
                        style={{
                          borderBottom: idx < visible.length - 1 ? "1px solid var(--border-subtle, #f1f5f9)" : "none",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "var(--surface-subtle, #f8fafc)")
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      >
                        <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                          {batch.medicineName}
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <code
                            style={{
                              background: "var(--surface-subtle, #f1f5f9)",
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: 12,
                              color: "var(--text-secondary, #475569)",
                            }}
                          >
                            {batch.batchNumber}
                          </code>
                        </td>
                        <td style={{ padding: "13px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {facilities.find((f) => f.id === batch.facilityId)?.name ?? "Unknown"}
                        </td>
                        <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                          {batch.quantityOnHand.toLocaleString()}
                        </td>
                        <td style={{ padding: "13px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {new Date(batch.expiryDateUtc).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 9999,
                              fontSize: 11,
                              fontWeight: 600,
                              ...badgeStyle,
                            }}
                          >
                            {expired ? "Expired" : daysLeft <= 30 ? "Expiring Soon" : "Monitor"}
                          </span>
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <Link
                            to={`/batches/${batch.id}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              color: "var(--color-primary-700, #0f766e)",
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            <Eye size={14} /> Review batch
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
