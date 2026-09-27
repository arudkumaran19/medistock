import React, { useState, useEffect, useCallback, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { procurementApi, type SupplierItem, type PurchaseOrder, type SupplierRequest } from "../../services/procurementApi";
import { PageHeader } from "../../components/ui";
import styles from "./ProcurementPages.module.css";
import {
  ArrowLeft,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<SupplierItem | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [editForm, setEditForm] = useState<SupplierRequest>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    leadTimeDays: 5,
    isActive: true,
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [supplierData, allOrders] = await Promise.all([
        procurementApi.getSupplierById(id),
        procurementApi.getPurchaseOrders(),
      ]);
      setSupplier(supplierData);
      setOrders(allOrders.filter((o) => o.supplierId === id));
      setEditForm({
        name: supplierData.name,
        contactPerson: supplierData.contactPerson || "",
        email: supplierData.email || supplierData.contactEmail || "",
        phone: supplierData.phone || supplierData.contactPhone || "",
        address: supplierData.address || "",
        leadTimeDays: supplierData.leadTimeDays ?? 5,
        isActive: supplierData.isActive,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load supplier profile.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      await procurementApi.updateSupplier(id, editForm);
      setSuccessMessage("Supplier information successfully updated.");
      setIsEditModalOpen(false);
      void loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update supplier.");
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className={styles.emptyState}>
          <div className="spinner mb-2" style={{ margin: "0 auto" }} />
          <p>Loading supplier profile…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!supplier) {
    return (
      <DashboardLayout>
        <div className={styles.errorBanner}>Supplier not found.</div>
        <Link to="/procurement/suppliers" className={styles.primaryButton}>
          <ArrowLeft size={16} /> Back to Directory
        </Link>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/procurement/suppliers"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#0f766e",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "var(--text-sm, 13px)",
          }}
        >
          <ArrowLeft size={16} /> Back to Supplier Directory
        </Link>
      </div>

      <PageHeader
        eyebrow="Supplier Profile"
        title={supplier.name}
        subtitle={`Representative: ${supplier.contactPerson || "Primary Commercial Contact"}`}
        actions={
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setIsEditModalOpen(true)}
          >
            <Edit3 size={15} /> Edit Profile
          </button>
        }
      />

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

      {/* Profile Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Compliance Status</p>
          <div style={{ marginTop: 8 }}>
            {supplier.isActive ? (
              <span className={styles.badgeSuccess}>
                <CheckCircle2 size={12} /> Active Approved
              </span>
            ) : (
              <span className={styles.badgeDanger}>
                <X size={12} /> Suspended / Inactive
              </span>
            )}
          </div>
        </div>

        <div className={styles.statCard}>
          <p className={styles.statLabel}>Direct Contact</p>
          <p style={{ margin: "8px 0 0 0", fontWeight: 600, color: "#0f172a" }}>
            {supplier.contactPerson || "Primary Contact"}
          </p>
        </div>

        <div className={styles.statCard}>
          <p className={styles.statLabel}>Email Address</p>
          <p style={{ margin: "8px 0 0 0", fontWeight: 600, color: "#0f766e" }}>
            {supplier.email || supplier.contactEmail || "Not on file"}
          </p>
        </div>

        <div className={styles.statCard}>
          <p className={styles.statLabel}>Telephone</p>
          <p style={{ margin: "8px 0 0 0", fontWeight: 600, color: "#0f172a" }}>
            {supplier.phone || supplier.contactPhone || "Not on file"}
          </p>
        </div>

        <div className={styles.statCard}>
          <p className={styles.statLabel}>Standard Lead Time</p>
          <p style={{ margin: "8px 0 0 0", fontWeight: 600, color: "#0f172a" }}>
            {supplier.leadTimeDays ?? 5} business days
          </p>
        </div>

        <div className={styles.statCard} style={{ gridColumn: "span 2" }}>
          <p className={styles.statLabel}>Warehouse / Logistics Facility</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "0.875rem", color: "#334155" }}>
            {supplier.address || "No physical dispatch address recorded"}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", margin: 0, fontWeight: 700 }}>
          Associated Purchase Orders ({orders.length})
        </h2>
      </div>

      <div className={styles.tableWrap}>
        {orders.length === 0 ? (
          <div className={styles.emptyState}>No purchase orders on record for this supplier yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>PO Reference</th>
                <th className={styles.th}>Date Requested</th>
                <th className={styles.th}>Items Count</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className={styles.tr}>
                  <td className={styles.td}>
                    <code>{order.id.slice(0, 8)}…</code>
                  </td>
                  <td className={styles.td}>{new Date(order.requestedAt).toLocaleDateString()}</td>
                  <td className={styles.td}>{order.items?.length ?? 0} items</td>
                  <td className={styles.td}>
                    <span
                      className={
                        order.status === "Approved"
                          ? styles.badgeSuccess
                          : order.status === "PendingApproval"
                          ? styles.badgeWarning
                          : order.status === "Rejected"
                          ? styles.badgeDanger
                          : styles.badgeNeutral
                      }
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <Link
                      to="/procurement/orders"
                      className={styles.secondaryButton}
                      style={{ padding: "4px 10px", fontSize: "0.75rem", textDecoration: "none" }}
                    >
                      View in Orders
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isEditModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Edit Supplier Profile</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Supplier Name *</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Contact Person *</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    value={editForm.contactPerson}
                    onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Contact Email *</label>
                    <input
                      type="email"
                      required
                      className={styles.formInput}
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      className={styles.formInput}
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Dispatch Address</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={editForm.address ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Lead Time (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className={styles.formInput}
                      value={editForm.leadTimeDays ?? 5}
                      onChange={(e) => setEditForm({ ...editForm, leadTimeDays: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Supplier Status</label>
                    <select
                      className={styles.filterSelect}
                      style={{ height: 40 }}
                      value={editForm.isActive ? "true" : "false"}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "true" })}
                    >
                      <option value="true">Active (Approved)</option>
                      <option value="false">Suspended / Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton}>
                  Update Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
