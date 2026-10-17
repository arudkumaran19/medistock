import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Package,
  Truck,
  ArrowRight,
  Search,
  Info,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { RouteMap } from '../features/redistribution/RouteMap';
import { transferApi, type Transfer, type TransferRoute } from '../features/redistribution/api';
import { procurementApi, type PurchaseOrder, type Delivery } from '../services/procurementApi';
import { apiRequest } from '../services/apiClient';
import styles from './TrackingPage.module.css';

interface SupplierMap {
  [id: string]: string;
}
interface MedicineMap {
  [id: string]: string;
}
interface FacilityMap {
  [id: string]: string;
}

export function TrackingPage() {
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialRef = searchParams.get('ref') || '';

  const [activeTab, setActiveTab] = useState<'transfers' | 'procurement'>('transfers');
  const [searchTerm, setSearchTerm] = useState(initialRef);

  // Transfers state
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [transferRoute, setTransferRoute] = useState<TransferRoute | null>(null);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);

  // Procurement state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poDelivery, setPoDelivery] = useState<Delivery | null>(null);
  const [isLoadingProcurement, setIsLoadingProcurement] = useState(true);

  // Lookup maps
  const [supplierMap, setSupplierMap] = useState<SupplierMap>({});
  const [medicineMap, setMedicineMap] = useState<MedicineMap>({});
  const [facilityMap, setFacilityMap] = useState<FacilityMap>({});

  // Load reference maps + transfers
  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setIsLoadingTransfers(true);
      try {
        // Load transfers
        const res = await transferApi.list({ pageSize: 50 });
        if (isMounted) {
          setTransfers(res.items);
          if (res.items.length > 0) {
            const match = initialRef
              ? res.items.find((t) =>
                  t.transferNumber.toLowerCase().includes(initialRef.toLowerCase())
                )
              : null;
            setSelectedTransfer(match || res.items[0]);
          }
        }
      } catch {
        // Offline / unauthenticated
      } finally {
        if (isMounted) setIsLoadingTransfers(false);
      }

      // Load lookup data in parallel, best-effort
      try {
        const [suppliers, medicines, facilities] = await Promise.all([
          apiRequest<Array<{ id: string; name: string }>>('/api/suppliers'),
          apiRequest<Array<{ id: string; name: string }>>('/api/medicines'),
          apiRequest<Array<{ id: string; name: string }>>('/api/facilities'),
        ]);
        if (isMounted) {
          const sm: SupplierMap = {};
          suppliers.forEach((s) => { sm[s.id] = s.name; });
          setSupplierMap(sm);

          const mm: MedicineMap = {};
          medicines.forEach((m) => { mm[m.id] = m.name; });
          setMedicineMap(mm);

          const fm: FacilityMap = {};
          facilities.forEach((f) => { fm[f.id] = f.name; });
          setFacilityMap(fm);
        }
      } catch {
        // Non-essential, continue without maps
      }
    }
    void fetchData();
    return () => {
      isMounted = false;
    };
  }, [initialRef]);

  // Load route when selectedTransfer changes
  useEffect(() => {
    let isMounted = true;
    async function fetchRoute() {
      if (!selectedTransfer) {
        setTransferRoute(null);
        return;
      }
      try {
        const route = await transferApi.route(selectedTransfer.id);
        if (isMounted) setTransferRoute(route);
      } catch {
        if (isMounted) setTransferRoute(null);
      }
    }
    void fetchRoute();
    return () => { isMounted = false; };
  }, [selectedTransfer]);

  // Load procurement orders
  useEffect(() => {
    let isMounted = true;
    async function fetchProcurement() {
      setIsLoadingProcurement(true);
      try {
        const orders = await procurementApi.getPurchaseOrders();
        if (isMounted) {
          setPurchaseOrders(orders);
          if (orders.length > 0) {
            const match = initialRef
              ? orders.find((o) => o.id.toLowerCase().includes(initialRef.toLowerCase()))
              : null;
            setSelectedPO(match || orders[0]);
          }
        }
      } catch {
        // Unauthenticated or offline
      } finally {
        if (isMounted) setIsLoadingProcurement(false);
      }
    }
    void fetchProcurement();
    return () => { isMounted = false; };
  }, [initialRef]);

  // Load delivery details when selected PO changes
  useEffect(() => {
    let isMounted = true;
    async function fetchPoDelivery() {
      if (!selectedPO) {
        setPoDelivery(null);
        return;
      }
      try {
        const delivery = await procurementApi.getDeliveryByPurchaseOrder(selectedPO.id);
        if (isMounted) setPoDelivery(delivery);
      } catch {
        if (isMounted) setPoDelivery(null);
      }
    }
    void fetchPoDelivery();
    return () => { isMounted = false; };
  }, [selectedPO]);

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    if (!searchTerm) return transfers;
    const term = searchTerm.toLowerCase();
    return transfers.filter(
      (t) =>
        t.transferNumber.toLowerCase().includes(term) ||
        t.medicineName.toLowerCase().includes(term) ||
        (t.sourceFacilityName && t.sourceFacilityName.toLowerCase().includes(term)) ||
        t.destinationFacilityName.toLowerCase().includes(term)
    );
  }, [transfers, searchTerm]);

  // Filter POs
  const filteredPOs = useMemo(() => {
    if (!searchTerm) return purchaseOrders;
    const term = searchTerm.toLowerCase();
    return purchaseOrders.filter(
      (p) =>
        p.id.toLowerCase().includes(term) ||
        (supplierMap[p.supplierId] || '').toLowerCase().includes(term) ||
        (facilityMap[p.facilityId] || '').toLowerCase().includes(term)
    );
  }, [purchaseOrders, searchTerm, supplierMap, facilityMap]);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'InTransit': return styles.statusInTransit;
      case 'Delivered': return styles.statusDelivered;
      case 'Approved': return styles.statusApproved;
      case 'Reserved': return styles.statusReserved;
      case 'Requested': return styles.statusRequested;
      default: return styles.statusDraft;
    }
  };

  // Compute total for a PO using typed item fields
  const computePOTotal = (order: PurchaseOrder): number => {
    return order.items.reduce(
      (sum, item) => sum + item.requestedQuantity * item.unitPrice,
      0
    );
  };

  const userRoleDisplay = user?.roles?.join(', ') ?? 'User';

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <div className={styles.brandLogo}>
            <Truck size={18} />
          </div>
          <span className={styles.brandName}>MediStock</span>
          <span className={styles.brandBadge}>Transportation & Delivery Visibility</span>
        </Link>
        <div className={styles.navLinks}>
          <Link to="/" className={styles.navLink}>Home</Link>
          {isAuthenticated ? (
            <Link to="/dashboard" className={styles.navLink} style={{ color: '#2dd4bf', fontWeight: 600 }}>
              Open Dashboard ({userRoleDisplay})
            </Link>
          ) : (
            <Link to="/login" className={styles.navLink} style={{ color: '#2dd4bf', fontWeight: 600 }}>
              Sign In to MediStock
            </Link>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.main}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Delivery & Transportation Tracking</h1>
          <p className={styles.subtitle}>
            Monitor verified inter-facility medicine transfers and supplier pharmaceutical shipments across Sri Lanka.
          </p>
        </div>

        {/* Global Search */}
        <div className={styles.searchBar}>
          <Search size={20} color="#64748b" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by transfer reference, PO ID, medicine, supplier, or hospital..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tab Controls */}
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'transfers'}
            className={`${styles.tabButton} ${activeTab === 'transfers' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('transfers')}
          >
            <Truck size={18} />
            <span>Inter-Hospital Transfers ({filteredTransfers.length})</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'procurement'}
            className={`${styles.tabButton} ${activeTab === 'procurement' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('procurement')}
          >
            <Package size={18} />
            <span>Supplier Procurement Deliveries ({filteredPOs.length})</span>
          </button>
        </div>

        {/* ── Transfers View ── */}
        {activeTab === 'transfers' && (
          <div className={styles.trackingGrid}>
            <div className={styles.shipmentList}>
              <div className={styles.listHeader}>Active Redistribution Shipments</div>
              {isLoadingTransfers ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  Loading transfers...
                </div>
              ) : filteredTransfers.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No transfers match the criteria.
                </div>
              ) : (
                filteredTransfers.map((item) => {
                  const isSelected = selectedTransfer?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`${styles.shipmentItem} ${isSelected ? styles.shipmentItemActive : ''}`}
                      onClick={() => setSelectedTransfer(item)}
                    >
                      <div className={styles.itemTop}>
                        <span className={styles.itemRef}>{item.transferNumber}</span>
                        <span className={`${styles.itemStatus} ${getStatusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className={styles.itemRoute}>
                        <span>{item.sourceFacilityName || 'Source Unassigned'}</span>
                        <ArrowRight size={14} color="#94a3b8" />
                        <span>{item.destinationFacilityName}</span>
                      </div>
                      <div className={styles.itemMeta}>
                        {item.quantity} units · {item.medicineName} · Priority: {item.priority}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Transfer Detail */}
            {selectedTransfer ? (
              <div className={styles.detailCard}>
                <div className={styles.detailHeader}>
                  <div>
                    <h2 className={styles.detailTitle}>{selectedTransfer.transferNumber}</h2>
                    <div className={styles.detailSubtitle}>
                      {selectedTransfer.medicineName} ({selectedTransfer.quantity} {selectedTransfer.unit})
                      {' · '}Priority: <strong>{selectedTransfer.priority}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`${styles.itemStatus} ${getStatusClass(selectedTransfer.status)}`}>
                      {selectedTransfer.status}
                    </span>
                    {isAuthenticated && (
                      <Link
                        to={`/redistribution/transfers/${selectedTransfer.id}`}
                        style={{ fontSize: '0.8rem', color: '#0f766e', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}
                      >
                        Manage <ExternalLink size={14} />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Key Metrics */}
                <div className={styles.statsRow}>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>Origin Depot</div>
                    <div className={styles.statValue} style={{ fontSize: '1.05rem' }}>
                      {selectedTransfer.sourceFacilityName || 'Pending Source'}
                    </div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>Destination Facility</div>
                    <div className={styles.statValue} style={{ fontSize: '1.05rem' }}>
                      {selectedTransfer.destinationFacilityName}
                    </div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>Road Distance</div>
                    <div className={styles.statValue}>
                      {transferRoute?.distanceKm ? `${transferRoute.distanceKm} km` : '--'}
                    </div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>Est. Transit Duration</div>
                    <div className={styles.statValue}>
                      {transferRoute?.durationMinutes
                        ? `~${Math.round(transferRoute.durationMinutes)} mins`
                        : '--'}
                    </div>
                  </div>
                </div>

                {/* Route Map Projection */}
                {transferRoute ? (
                  <div className={styles.mapWrapper}>
                    <RouteMap route={transferRoute} />
                  </div>
                ) : (
                  <div style={{
                    background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px',
                    padding: '2rem', textAlign: 'center', color: '#64748b', marginBottom: '1.5rem',
                  }}>
                    Route calculation is displayed once source facility is assigned and approved.
                  </div>
                )}

                {/* Status Timeline */}
                <div className={styles.timeline}>
                  <div className={styles.timelineTitle}>Authoritative Lifecycle Timeline</div>
                  {selectedTransfer.history && selectedTransfer.history.length > 0 ? (
                    <ul className={styles.timelineList}>
                      {selectedTransfer.history.map((h, idx) => (
                        <li key={idx} className={styles.timelineItem}>
                          <div className={styles.timelineDot} />
                          <div className={styles.timelineItemTitle}>
                            Status updated to <strong>{h.toStatus}</strong>
                          </div>
                          <div className={styles.timelineItemTime}>
                            {new Date(h.changedAtUtc).toLocaleString()}
                            {' · '}by {h.changedBy || 'System / Officer'}
                          </div>
                          {h.reason && (
                            <div className={styles.timelineItemNote}>Note: {h.reason}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      Created: {new Date(selectedTransfer.createdAtUtc).toLocaleString()}
                      {' · '}Status: {selectedTransfer.status}
                    </div>
                  )}
                </div>

                <div className={styles.disclaimer}>
                  <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Demonstration Coordinates & Route Estimates:</strong> Map visualises road
                    route estimates between representative Sri Lankan municipal coordinates. Authoritative
                    delivery status is governed by physical dispatch and receipt validation.
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.detailCard} style={{ color: '#64748b' }}>
                Select a transfer to view tracking details.
              </div>
            )}
          </div>
        )}

        {/* ── Procurement Deliveries View ── */}
        {activeTab === 'procurement' && (
          <div className={styles.trackingGrid}>
            <div className={styles.shipmentList}>
              <div className={styles.listHeader}>Supplier Purchase Orders</div>
              {isLoadingProcurement ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  Loading purchase orders...
                </div>
              ) : filteredPOs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No purchase orders found.
                </div>
              ) : (
                filteredPOs.map((order) => {
                  const isSelected = selectedPO?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      className={`${styles.shipmentItem} ${isSelected ? styles.shipmentItemActive : ''}`}
                      onClick={() => setSelectedPO(order)}
                    >
                      <div className={styles.itemTop}>
                        <span className={styles.itemRef}>PO-{order.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`${styles.itemStatus} ${getStatusClass(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className={styles.itemRoute}>
                        <Building2 size={14} color="#0d9488" />
                        <span>
                          {facilityMap[order.facilityId] || `Facility ${order.facilityId.slice(0, 6)}`}
                        </span>
                      </div>
                      <div className={styles.itemMeta}>
                        Total: ${computePOTotal(order).toFixed(2)} · {order.items.length} line items
                        {' · '}Supplier: {supplierMap[order.supplierId] || order.supplierId.slice(0, 8)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected PO Detail */}
            {selectedPO ? (
              <div className={styles.detailCard}>
                <div className={styles.detailHeader}>
                  <div>
                    <h2 className={styles.detailTitle}>
                      PO-{selectedPO.id.slice(0, 8).toUpperCase()}
                    </h2>
                    <div className={styles.detailSubtitle}>
                      Delivery to {facilityMap[selectedPO.facilityId] || selectedPO.facilityId.slice(0, 8)}
                      {' · '}Requested: {new Date(selectedPO.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`${styles.itemStatus} ${getStatusClass(selectedPO.status)}`}>
                      {selectedPO.status}
                    </span>
                    {isAuthenticated && (
                      <Link
                        to="/procurement/orders"
                        style={{ fontSize: '0.8rem', color: '#0f766e', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}
                      >
                        Orders Console <ExternalLink size={14} />
                      </Link>
                    )}
                  </div>
                </div>

                <div className={styles.statsRow}>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>Order Total</div>
                    <div className={styles.statValue}>${computePOTotal(selectedPO).toFixed(2)}</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>Delivery Status</div>
                    <div className={styles.statValue} style={{ fontSize: '1.1rem' }}>
                      {poDelivery?.status || (selectedPO.status === 'Approved' ? 'Awaiting Dispatch' : selectedPO.status)}
                    </div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>Tracking Number</div>
                    <div className={styles.statValue} style={{ fontSize: '1rem', color: '#0d9488' }}>
                      {poDelivery?.trackingNumber || `TRACK-${selectedPO.id.slice(0, 8).toUpperCase()}`}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0f172a' }}>
                    Procurement Manifest
                  </h3>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b' }}>Medicine ID</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>Quantity</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>Unit Price</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPO.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                              {medicineMap[item.medicineId] || item.medicineId.slice(0, 8)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              {item.requestedQuantity}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              ${item.unitPrice.toFixed(2)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                              ${(item.requestedQuantity * item.unitPrice).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Delivery Milestones */}
                <div className={styles.timeline}>
                  <div className={styles.timelineTitle}>Procurement Delivery Milestones</div>
                  <ul className={styles.timelineList}>
                    <li className={styles.timelineItem}>
                      <div className={styles.timelineDot} />
                      <div className={styles.timelineItemTitle}>Purchase Order Created & Submitted</div>
                      <div className={styles.timelineItemTime}>
                        {new Date(selectedPO.requestedAt).toLocaleString()}
                      </div>
                    </li>
                    {selectedPO.status !== 'Draft' && (
                      <li className={styles.timelineItem}>
                        <div className={styles.timelineDot} />
                        <div className={styles.timelineItemTitle}>
                          Governance & Clinical Policy Checkpoint
                        </div>
                        <div className={styles.timelineItemTime}>
                          {selectedPO.approvedAt
                            ? `Approved: ${new Date(selectedPO.approvedAt).toLocaleString()}`
                            : 'Authorization checkpoint verified'}
                        </div>
                      </li>
                    )}
                    {poDelivery && (
                      <li className={styles.timelineItem}>
                        <div className={styles.timelineDot} />
                        <div className={styles.timelineItemTitle}>
                          Shipment Dispatched ({poDelivery.trackingNumber || 'No tracking ref'})
                        </div>
                        <div className={styles.timelineItemTime}>
                          Carrier assigned · Expected:{' '}
                          {poDelivery.expectedAt
                            ? new Date(poDelivery.expectedAt).toLocaleString()
                            : 'In Transit'}
                        </div>
                      </li>
                    )}
                    {selectedPO.status === 'Received' && (
                      <li className={styles.timelineItem}>
                        <div className={styles.timelineDot} style={{ background: '#16a34a' }} />
                        <div className={styles.timelineItemTitle} style={{ color: '#16a34a' }}>
                          Physical Stock Received & Reconciled
                        </div>
                        <div className={styles.timelineItemTime}>
                          Batches inspected and added to hospital inventory.
                        </div>
                      </li>
                    )}
                  </ul>
                </div>

                <div className={styles.disclaimer}>
                  <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Authoritative Procurement Verification:</strong> Deliveries from pharmaceutical
                    suppliers undergo two-way batch verification. Stock is added to usable inventory only
                    upon physical inspection by an authorized hospital store officer.
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.detailCard} style={{ color: '#64748b' }}>
                Select an order to view delivery details.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default TrackingPage;
