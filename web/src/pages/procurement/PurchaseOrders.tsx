import React, { useState, useEffect, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  procurementApi,
  type PurchaseOrder,
  type SupplierItem,
  type PurchaseOrderRequest,
  type Delivery,
  type DeliveryItem,
} from "../../services/procurementApi";
import { apiRequest } from "../../services/apiClient";
import { PageHeader, KPICard } from "../../components/ui";
import styles from "./ProcurementPages.module.css";
import {
  FileText,
  Clock,
  CheckCircle2,
  Package,
  Plus,
  Send,
  CalendarClock,
  PackageCheck,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";

interface MedicineOption {
  id: string;
  name: string;
  code: string;
  unitPrice?: number;
}

interface FacilityOption {
  id: string;
  name: string;
}

// Per-item batch details captured when marking a delivery as received
interface BatchEntry {
  medicineId: string;
  medicineName: string;
  quantity: number;
  batchNumber: string;
  expiryDateUtc: string;
  manufacturingDateUtc: string;
}

export function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // New PO draft state
  const [supplierId, setSupplierId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [items, setItems] = useState<
    { medicineId: string; requestedQuantity: number; unitPrice: number }[]
  >([{ medicineId: "", requestedQuantity: 100, unitPrice: 10.0 }]);

  // ── Delivery scheduling state ───────────────────────────────────────────────
  const [scheduleDeliveryOrder, setScheduleDeliveryOrder] = useState<PurchaseOrder | null>(null);
  const [scheduleTrackingNumber, setScheduleTrackingNumber] = useState("");
  const [scheduleExpectedAt, setScheduleExpectedAt] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [schedulingDelivery, setSchedulingDelivery] = useState(false);

  // ── Mark Delivered state ───────────────────────────────────────────────────
  const [deliverOrder, setDeliverOrder] = useState<PurchaseOrder | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [markingDelivered, setMarkingDelivered] = useState(false);

  // ── Deliveries cache: orderId -> delivery ──────────────────────────────────
  const [deliveryCache, setDeliveryCache] = useState<Record<string, Delivery | null>>({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [orderList, supplierList] = await Promise.all([
        procurementApi.getPurchaseOrders(),
        procurementApi.getSuppliers(undefined, true),
      ]);
      setOrders(orderList);
      setSuppliers(supplierList);

      // Load medicines and facilities for the PO modal
      try {
        const [medList, facList] = await Promise.all([
          apiRequest<MedicineOption[]>("/api/medicines"),
          apiRequest<FacilityOption[]>("/api/facilities"),
        ]);
        setMedicines(medList);
        setFacilities(facList);
        if (facList.length > 0 && !facilityId) setFacilityId(facList[0].id);
        if (supplierList.length > 0 && !supplierId) setSupplierId(supplierList[0].id);
      } catch {
        // Fallback if catalog not seeded yet
      }

      // Fetch delivery status for Approved/Received orders
      const approvedOrReceived = orderList.filter(
        (o) => o.status === "Approved" || o.status === "Received"
      );
      const deliveryResults = await Promise.allSettled(
        approvedOrReceived.map(async (o) => {
          const d = await procurementApi.getDeliveryByPurchaseOrder(o.id);
          return { orderId: o.id, delivery: d };
        })
      );
      const newCache: Record<string, Delivery | null> = {};
      for (const res of deliveryResults) {
        if (res.status === "fulfilled" && res.value.delivery) {
          newCache[res.value.orderId] = res.value.delivery;
        }
      }
      setDeliveryCache(newCache);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load purchase orders.");
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, supplierId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Lookup helpers
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const medicineMap = new Map(medicines.map((m) => [m.id, m.name]));

  // Submit PO (moves Draft -> PendingApproval)
  async function handleSubmitOrder(id: string) {
    setError(null);
    try {
      await procurementApi.submitPurchaseOrder(id);
      setSuccessMessage(`Purchase order ${id.slice(0, 8)}… submitted for approval.`);
      void loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit purchase order.");
    }
  }

  // ── Handlers for scheduling delivery ───────────────────────────────────────
  function openScheduleDelivery(order: PurchaseOrder) {
    setScheduleDeliveryOrder(order);
    const existing = deliveryCache[order.id];
    setScheduleTrackingNumber(existing?.trackingNumber ?? "");
    setScheduleExpectedAt(
      existing?.expectedAt
        ? existing.expectedAt.slice(0, 10)
        : new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    );
    setScheduleNotes(existing?.notes ?? "");
  }

  async function handleScheduleDelivery(e: FormEvent) {
    e.preventDefault();
    if (!scheduleDeliveryOrder) return;
    setSchedulingDelivery(true);
    setError(null);
    try {
      await procurementApi.createDelivery(
        scheduleDeliveryOrder.id,
        scheduleExpectedAt ? new Date(scheduleExpectedAt).toISOString() : undefined,
        scheduleTrackingNumber.trim() || undefined,
        scheduleNotes.trim() || undefined
      );
      setSuccessMessage(`Delivery scheduled for order ${scheduleDeliveryOrder.id.slice(0, 8)}…`);
      setScheduleDeliveryOrder(null);
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule delivery.");
    } finally {
      setSchedulingDelivery(false);
    }
  }

  // ── Handlers for marking delivery received ─────────────────────────────────
  async function openMarkDelivered(order: PurchaseOrder) {
    setDeliverOrder(order);
    setError(null);
    let del = deliveryCache[order.id];
    if (!del) {
      del = await procurementApi.getDeliveryByPurchaseOrder(order.id);
    }
    setActiveDelivery(del);

    // Initial batch rows for each item in the PO
    const now = new Date();
    const defaultMfg = now.toISOString().slice(0, 10);
    const defaultExp = new Date(now.getTime() + 365 * 86400000).toISOString().slice(0, 10);

    const initialBatches: BatchEntry[] = (order.items || []).map((it, idx) => ({
      medicineId: it.medicineId,
      medicineName: medicineMap.get(it.medicineId) ?? `Medicine ${it.medicineId.slice(0, 6)}`,
      quantity: it.requestedQuantity,
      batchNumber: `BATCH-${String(idx + 1).padStart(3, "0")}`,
      manufacturingDateUtc: defaultMfg,
      expiryDateUtc: defaultExp,
    }));
    setBatchEntries(initialBatches);
  }

  async function handleMarkDelivered(e: FormEvent) {
    e.preventDefault();
    if (!deliverOrder || !activeDelivery) return;

    for (const b of batchEntries) {
      if (!b.batchNumber.trim()) {
        setError(`Batch number is required for ${b.medicineName}.`);
        return;
      }
      if (!b.manufacturingDateUtc || !b.expiryDateUtc) {
        setError(`Manufacturing and expiry dates are required for ${b.medicineName}.`);
        return;
      }
      if (new Date(b.expiryDateUtc) <= new Date(b.manufacturingDateUtc)) {
        setError(`Expiry date must be after manufacturing date for ${b.medicineName}.`);
        return;
      }
    }

    setMarkingDelivered(true);
    setError(null);
    try {
      const deliveryItems: DeliveryItem[] = batchEntries.map((b) => ({
        medicineId: b.medicineId,
        quantity: b.quantity,
        batchNumber: b.batchNumber.trim(),
        expiryDateUtc: new Date(b.expiryDateUtc).toISOString(),
        manufacturingDateUtc: new Date(b.manufacturingDateUtc).toISOString(),
      }));

      await procurementApi.markDelivered(activeDelivery.id, deliveryItems);
      setSuccessMessage(
        `Delivery confirmed and inventory received for PO ${deliverOrder.id.slice(0, 8)}… Batches created successfully.`
      );
      setDeliverOrder(null);
      setActiveDelivery(null);
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark delivery received.");
    } finally {
      setMarkingDelivered(false);
    }
  }

  // ── New PO Draft Form Handlers ─────────────────────────────────────────────
  function handleAddItem() {
    setItems([...items, { medicineId: "", requestedQuantity: 100, unitPrice: 10.0 }]);
  }

  function handleRemoveItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function handleCreatePO(e: FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      setError("Please select a vendor.");
      return;
    }
    if (!facilityId) {
      setError("Please select a receiving facility.");
      return;
    }
    if (items.some((it) => !it.medicineId || it.requestedQuantity <= 0 || it.unitPrice < 0)) {
      setError("Please fill all item lines with a valid medicine, quantity (> 0), and price (>= 0).");
      return;
    }

    setError(null);
    try {
      const payload: PurchaseOrderRequest = {
        supplierId,
        facilityId,
        items,
      };
      await procurementApi.createPurchaseOrder(payload);
      setSuccessMessage("Draft purchase order created successfully.");
      setIsModalOpen(false);
      setItems([{ medicineId: "", requestedQuantity: 100, unitPrice: 10.0 }]);
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase order.");
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "all") return true;
    return o.status.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <>
      <PageHeader
        eyebrow="Purchasing Operations"
        title="Purchase Orders"
        subtitle="Create, evaluate, and track medical supplies procurement requisitions across health facilities."
        actions={
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Draft Purchase Order
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

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Total Orders"
          value={orders.length}
          context="Requisitions on record"
          icon={<FileText size={20} />}
          accent="#0f766e"
        />
        <KPICard
          label="Pending Approval"
          value={orders.filter((o) => o.status === "PendingApproval").length}
          context="Awaiting sign-off"
          icon={<Clock size={20} />}
          accent="#d97706"
          variant="warning"
        />
        <KPICard
          label="Approved"
          value={orders.filter((o) => o.status === "Approved").length}
          context="Cleared for shipment"
          icon={<CheckCircle2 size={20} />}
          accent="#0f766e"
          variant="success"
        />
        <KPICard
          label="Received"
          value={orders.filter((o) => o.status === "Received").length}
          context="Ingested to inventory"
          icon={<Package size={20} />}
          accent="#2563eb"
        />
      </div>

      <div className={styles.toolbar}>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter Orders by Status"
        >
          <option value="all">All Statuses ({orders.length})</option>
          <option value="draft">Drafts</option>
          <option value="pendingapproval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="received">Received</option>
          <option value="rejected">Rejected</option>
          <option value="revisionrequired">Revision Required</option>
        </select>
        <Link to="/procurement/workflow" className={styles.secondaryButton}>
          Visual Workflow Monitor →
        </Link>
      </div>

      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className="spinner mb-2" style={{ margin: "0 auto" }} />
            <p>Loading purchase orders…</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className={styles.emptyState}>No purchase orders match your filter criteria.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>PO Reference</th>
                <th className={styles.th}>Supplier</th>
                <th className={styles.th}>Items Count</th>
                <th className={styles.th}>Est. Total</th>
                <th className={styles.th}>Requested At</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Delivery</th>
                <th className={styles.th} style={{ minWidth: 230 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const totalCost = (order.items || []).reduce(
                  (sum, it) => sum + it.requestedQuantity * it.unitPrice,
                  0
                );
                const delivery = deliveryCache[order.id];
                return (
                  <tr key={order.id} className={styles.tr}>
                    <td className={styles.td}>
                      <code>PO-{order.id.slice(0, 8)}</code>
                    </td>
                    <td className={styles.td} style={{ fontWeight: 600 }}>{supplierMap.get(order.supplierId) || order.supplierId.slice(0, 8)}</td>
                    <td className={styles.td} style={{ whiteSpace: "nowrap" }}>{order.items?.length ?? 0} item(s)</td>
                    <td className={styles.td} style={{ whiteSpace: "nowrap" }}>
                      <strong style={{ color: "#0f172a" }}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </td>
                    <td className={styles.td} style={{ whiteSpace: "nowrap" }}>{new Date(order.requestedAt).toLocaleDateString()}</td>
                    <td className={styles.td}>
                      <span
                        className={
                          order.status === "Approved" || order.status === "Received"
                            ? styles.badgeSuccess
                            : order.status === "PendingApproval"
                            ? styles.badgeWarning
                            : order.status === "Rejected"
                            ? styles.badgeDanger
                            : order.status === "RevisionRequired"
                            ? styles.badgeWarning
                            : styles.badgeNeutral
                        }
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className={styles.td}>
                      {delivery ? (
                        <span
                          className={
                            delivery.status === "Delivered"
                              ? styles.badgeSuccess
                              : styles.badgeWarning
                          }
                        >
                          {delivery.status}
                        </span>
                      ) : order.status === "Approved" ? (
                        <span style={{ color: "#94a3b8", fontSize: "0.75rem", whiteSpace: "nowrap" }}>Not scheduled</span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>—</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actionCell}>
                        <button
                          type="button"
                          className={styles.actionBtnSecondary}
                          onClick={() => setSelectedOrder(order)}
                          title="View order items"
                        >
                          <Eye size={13} /> View Items
                        </button>
                        {(order.status === "Draft" || order.status === "RevisionRequired") && (
                          <button
                            type="button"
                            className={styles.actionBtnPrimary}
                            onClick={() => void handleSubmitOrder(order.id)}
                            title="Submit purchase order"
                          >
                            <Send size={13} /> Submit
                          </button>
                        )}
                        {order.status === "Approved" && !delivery && (
                          <button
                            type="button"
                            className={styles.actionBtnPrimary}
                            onClick={() => openScheduleDelivery(order)}
                            title="Schedule shipment delivery"
                          >
                            <CalendarClock size={13} /> Schedule Delivery
                          </button>
                        )}
                        {order.status === "Approved" &&
                          delivery &&
                          delivery.status !== "Delivered" && (
                          <button
                            type="button"
                            className={styles.actionBtnPrimary}
                            style={{ backgroundColor: "#2563eb", borderColor: "#1d4ed8" }}
                            onClick={() => void openMarkDelivered(order)}
                            title="Mark shipment as delivered"
                          >
                            <PackageCheck size={13} /> Mark Delivered
                          </button>
                        )}
                        {(order.status === "Received" || delivery?.status === "Delivered") && (
                          <span className={styles.badgeSuccess}>
                            <CheckCircle2 size={12} /> In Stock
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PO Items Details Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog} style={{ maxWidth: 640 }}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>
                Purchase Order Details: {selectedOrder.id.slice(0, 8)}…
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                onClick={() => setSelectedOrder(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div>
                <p style={{ margin: "0 0 6px 0", fontSize: "0.875rem" }}>
                  <strong>Status:</strong> {selectedOrder.status}
                </p>
                {selectedOrder.rejectionReason && (
                  <p style={{ color: "#991b1b", fontSize: "0.875rem", margin: "4px 0" }}>
                    <strong>Rejection Reason:</strong> {selectedOrder.rejectionReason}
                  </p>
                )}
                {selectedOrder.revisionReason && (
                  <p style={{ color: "#92400e", fontSize: "0.875rem", margin: "4px 0" }}>
                    <strong>Revision Requested:</strong> {selectedOrder.revisionReason}
                  </p>
                )}
              </div>

              <h4 style={{ margin: "12px 0 6px 0", fontSize: "0.875rem" }}>Requisition Items</h4>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Medicine</th>
                      <th className={styles.th}>Qty</th>
                      <th className={styles.th}>Unit Price</th>
                      <th className={styles.th}>Line Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.items || []).map((it, i) => (
                      <tr key={i}>
                        <td className={styles.td}>
                          {medicineMap.get(it.medicineId) ?? <code>{it.medicineId.slice(0, 8)}…</code>}
                        </td>
                        <td className={styles.td}>{it.requestedQuantity}</td>
                        <td className={styles.td}>${it.unitPrice.toFixed(2)}</td>
                        <td className={styles.td}>${(it.requestedQuantity * it.unitPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Delivery Modal */}
      {scheduleDeliveryOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog} style={{ maxWidth: 520 }}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>
                Schedule Delivery — PO {scheduleDeliveryOrder.id.slice(0, 8)}…
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                onClick={() => setScheduleDeliveryOrder(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => void handleScheduleDelivery(e)}>
              <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Expected Delivery Date</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={scheduleExpectedAt}
                    onChange={(e) => setScheduleExpectedAt(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tracking Number</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. TRK-202600001"
                    value={scheduleTrackingNumber}
                    onChange={(e) => setScheduleTrackingNumber(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Notes</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Optional delivery notes"
                    value={scheduleNotes}
                    onChange={(e) => setScheduleNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setScheduleDeliveryOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={schedulingDelivery}
                >
                  {schedulingDelivery ? "Scheduling…" : "Schedule Delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Delivered Modal */}
      {deliverOrder && activeDelivery && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog} style={{ maxWidth: 700 }}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>
                Confirm Delivery & Stock Receipt — PO {deliverOrder.id.slice(0, 8)}…
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                onClick={() => {
                  setDeliverOrder(null);
                  setActiveDelivery(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => void handleMarkDelivered(e)}>
              <div className={styles.modalBody}>
                <p style={{ margin: "0 0 12px 0", fontSize: "0.875rem", color: "#64748b" }}>
                  Enter lot and batch details for each received item. Confirming will automatically integrate batches into facility inventory stock levels.
                </p>

                {batchEntries.map((entry, idx) => (
                  <div
                    key={entry.medicineId}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: 14,
                      marginBottom: 12,
                      background: "#f8fafc",
                    }}
                  >
                    <p style={{ margin: "0 0 10px 0", fontWeight: 600, fontSize: "0.875rem" }}>
                      {entry.medicineName}
                      <span style={{ color: "#64748b", fontWeight: 400, marginLeft: 8 }}>
                        × {entry.quantity} units
                      </span>
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Batch number *</label>
                        <input
                          type="text"
                          required
                          className={styles.formInput}
                          placeholder="BATCH-001"
                          value={entry.batchNumber}
                          onChange={(e) => {
                            const updated = [...batchEntries];
                            updated[idx] = { ...entry, batchNumber: e.target.value };
                            setBatchEntries(updated);
                          }}
                        />
                        <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginTop: 2 }}>
                          Format: BATCH-### (e.g. BATCH-001)
                        </span>
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Manufacturing Date *</label>
                        <input
                          type="date"
                          required
                          className={styles.formInput}
                          value={entry.manufacturingDateUtc}
                          onChange={(e) => {
                            const updated = [...batchEntries];
                            updated[idx] = { ...entry, manufacturingDateUtc: e.target.value };
                            setBatchEntries(updated);
                          }}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Expiry Date *</label>
                        <input
                          type="date"
                          required
                          className={styles.formInput}
                          value={entry.expiryDateUtc}
                          onChange={(e) => {
                            const updated = [...batchEntries];
                            updated[idx] = { ...entry, expiryDateUtc: e.target.value };
                            setBatchEntries(updated);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {error && (
                  <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: "8px 0 0 0" }}>
                    {error}
                  </p>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setDeliverOrder(null);
                    setActiveDelivery(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={markingDelivered}
                  style={{ background: "#2563eb" }}
                >
                  <PackageCheck size={16} />
                  {markingDelivered ? "Updating inventory…" : "Confirm & Update Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create PO Draft Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog} style={{ maxWidth: 680 }}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Create Draft Purchase Order</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => void handleCreatePO(e)}>
              <div className={styles.modalBody}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Supplier *</label>
                    <select
                      className={styles.formInput}
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      required
                    >
                      <option value="">Select Vendor</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Receiving Facility *</label>
                    <select
                      className={styles.formInput}
                      value={facilityId}
                      onChange={(e) => setFacilityId(e.target.value)}
                      required
                    >
                      <option value="">Select Facility</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label className={styles.formLabel}>Items to Procure</label>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                      onClick={handleAddItem}
                    >
                      <Plus size={12} /> Add Item
                    </button>
                  </div>

                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr auto",
                        gap: 10,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <select
                        className={styles.formInput}
                        value={it.medicineId}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].medicineId = e.target.value;
                          setItems(updated);
                        }}
                        required
                      >
                        <option value="">Select Medicine</option>
                        {medicines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.code})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        placeholder="Quantity"
                        className={styles.formInput}
                        value={it.requestedQuantity}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].requestedQuantity = parseInt(e.target.value) || 0;
                          setItems(updated);
                        }}
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit Price"
                        className={styles.formInput}
                        value={it.unitPrice}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                          setItems(updated);
                        }}
                        required
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#dc2626",
                            cursor: "pointer",
                            padding: 4,
                          }}
                          onClick={() => handleRemoveItem(idx)}
                          aria-label="Remove item"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
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
                  Create Draft Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
