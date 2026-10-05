import React, { useState, useEffect, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ProcurementAgentPanel } from "../../components/ProcurementAgentPanel";
import { procurementApi, type SupplierItem, type SupplierRequest } from "../../services/procurementApi";
import { PageHeader, KPICard } from "../../components/ui";
import styles from "./ProcurementPages.module.css";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";

export function SupplierDashboard() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for creating a supplier
  const [formData, setFormData] = useState<SupplierRequest>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    leadTimeDays: 5,
    isActive: true,
  });

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeParam = statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined;
      const data = await procurementApi.getSuppliers(search || undefined, activeParam);
      setSuppliers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers.");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSuppliers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadSuppliers]);

  async function handleCreateSupplier(e: FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    if (!formData.contactPerson.trim()) {
      setError("Contact person name is required.");
      return;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setError("A valid contact email address is required.");
      return;
    }
    if (!formData.phone.trim()) {
      setError("Contact phone number is required.");
      return;
    }

    setError(null);
    try {
      await procurementApi.createSupplier(formData);
      setSuccessMessage(`Supplier "${formData.name}" successfully registered.`);
      setIsModalOpen(false);
      setFormData({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        leadTimeDays: 5,
        isActive: true,
      });
      void loadSuppliers();
    } catch (e) {
      setError(
        e instanceof Error
          ? (e.message.includes("400") ? "We couldn't add this supplier. Please check the required fields and try again." : e.message)
          : "We couldn't add this supplier. Please check the required fields and try again."
      );
    }
  }

  const totalCount = suppliers.length;
  const activeCount = suppliers.filter((s) => s.isActive).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <>
      <PageHeader
        eyebrow="Procurement Logistics"
        title="Supplier Directory"
        subtitle="Manage verified pharmaceutical and medical supply vendors, status certifications, and lead times."
        actions={
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Register New Supplier
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard
          label="Total Vendors"
          value={totalCount}
          context="Enrolled suppliers"
          icon={<Building2 size={20} />}
          accent="#0f766e"
        />
        <KPICard
          label="Active Approved"
          value={activeCount}
          context="Authorized for purchase orders"
          icon={<CheckCircle2 size={20} />}
          accent="#16a34a"
          variant="success"
        />
        <KPICard
          label="Suspended / Inactive"
          value={inactiveCount}
          context="Blocked from procurement"
          icon={<AlertTriangle size={20} />}
          accent="#dc2626"
          variant={inactiveCount > 0 ? "danger" : "default"}
        />
      </div>

      <ProcurementAgentPanel onOrderCreated={() => void loadSuppliers()} />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className={styles.successBanner} role="status">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchGroup}>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              className={styles.searchInput}
              style={{ width: "100%", paddingLeft: 36 }}
              placeholder="Search suppliers by name or vendor code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
          </div>
        </div>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by Status"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className="spinner mb-2" style={{ margin: "0 auto" }} />
            <p>Loading supplier registry…</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className={styles.emptyState}>No suppliers match your current filter.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Supplier Name</th>
                <th className={styles.th}>Contact Person</th>
                <th className={styles.th}>Email</th>
                <th className={styles.th}>Phone</th>
                <th className={styles.th}>Lead Time</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th} style={{ minWidth: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className={styles.tr}>
                  <td className={styles.td}>
                    <strong>{supplier.name}</strong>
                  </td>
                  <td className={styles.td}>{supplier.contactPerson || "Primary Contact"}</td>
                  <td className={styles.td} style={{ whiteSpace: "nowrap" }}>{supplier.email || supplier.contactEmail || "—"}</td>
                  <td className={styles.td} style={{ whiteSpace: "nowrap" }}>{supplier.phone || supplier.contactPhone || "—"}</td>
                  <td className={styles.td} style={{ whiteSpace: "nowrap" }}>{supplier.leadTimeDays ?? 5} days</td>
                  <td className={styles.td}>
                    {supplier.isActive ? (
                      <span className={styles.badgeSuccess}>Active</span>
                    ) : (
                      <span className={styles.badgeDanger}>Inactive</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <Link
                      to={`/procurement/suppliers/${supplier.id}`}
                      className={styles.actionBtnSecondary}
                      title="View supplier profile and contracts"
                    >
                      <Eye size={13} /> View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Register New Supplier</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Supplier Name *</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="e.g. Apex Pharma Ltd."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Contact Person *</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="e.g. Dr. Arthur Vance"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Contact Email *</label>
                    <input
                      type="email"
                      required
                      className={styles.formInput}
                      placeholder="orders@apexpharma.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      className={styles.formInput}
                      placeholder="+1 (555) 234-5678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Warehouse Address</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. 104 Logistics Way, Suite 400"
                    value={formData.address ?? ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Standard Lead Time (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className={styles.formInput}
                      value={formData.leadTimeDays ?? 5}
                      onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Initial Status</label>
                    <select
                      className={styles.filterSelect}
                      style={{ height: 40 }}
                      value={formData.isActive ? "true" : "false"}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "true" })}
                    >
                      <option value="true">Active (Approved)</option>
                      <option value="false">Inactive (Suspended)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton}>
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
