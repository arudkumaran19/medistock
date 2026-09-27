import { apiRequest } from "./apiClient";

export interface SupplierItem {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  isActive: boolean;
  code?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface SupplierRequest {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  isActive: boolean;
  code?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface PurchaseOrderItem {
  id?: string;
  medicineId: string;
  requestedQuantity: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  facilityId: string;
  status: string; // "Draft" | "PendingApproval" | "Approved" | "Rejected" | "RevisionRequired"
  requestedAt: string;
  approvedAt?: string | null;
  approvedById?: string | null;
  rejectionReason?: string | null;
  revisionReason?: string | null;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderRequest {
  supplierId: string;
  facilityId: string;
  items: {
    medicineId: string;
    requestedQuantity: number;
    unitPrice: number;
  }[];
}

export interface PolicyRule {
  ruleName: string;
  description: string;
  ruleType: string;
  threshold?: number | null;
  requiresApproval: boolean;
}

export interface ValidateProcurementItemRequest {
  medicineId: string;
  requestedQuantity: number;
  unitPrice: number;
}

export interface ValidateProcurementRequest {
  supplierId: string;
  facilityId: string;
  items: ValidateProcurementItemRequest[];
  // Compatibility fields if passed:
  totalCost?: number;
  totalQuantity?: number;
}

export interface ValidateProcurementResponse {
  isValid: boolean;
  code: string;
  message: string;
  requiresApproval: boolean;
  totalEstimatedCost: number;
  supplierLeadTimeDays: number;
  approverRole?: string | null;
  warnings?: string[];
}

export interface DeliveryItem {
  medicineId: string;
  quantity: number;
  batchNumber: string;
  expiryDateUtc: string;      // ISO-8601
  manufacturingDateUtc: string; // ISO-8601
}

export interface Delivery {
  id: string;
  purchaseOrderId: string;
  status: string; // "Pending" | "InTransit" | "Delivered" | "Cancelled"
  expectedAt?: string | null;
  deliveredAt?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const procurementApi = {
  // ── Suppliers ─────────────────────────────────────────────────────────────
  async getSuppliers(search?: string, isActive?: boolean): Promise<SupplierItem[]> {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (isActive !== undefined) params.append("isActive", String(isActive));
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<SupplierItem[]>(`/api/suppliers${query}`);
  },

  async getSupplierById(id: string): Promise<SupplierItem> {
    return apiRequest<SupplierItem>(`/api/suppliers/${id}`);
  },

  async createSupplier(request: SupplierRequest): Promise<SupplierItem> {
    const payload = {
      name: request.name?.trim() || "",
      contactPerson: (request.contactPerson || "Primary Representative").trim(),
      email: (request.email || request.contactEmail || "supplier@medistock.com").trim(),
      phone: (request.phone || request.contactPhone || "+1-555-0100").trim(),
      address: (request.address || "Main Medical Distribution Center").trim(),
      leadTimeDays: request.leadTimeDays ?? 5,
      isActive: request.isActive ?? true,
    };
    return apiRequest<SupplierItem>("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateSupplier(id: string, request: SupplierRequest): Promise<SupplierItem> {
    const payload = {
      name: request.name?.trim() || "",
      contactPerson: (request.contactPerson || "Primary Representative").trim(),
      email: (request.email || request.contactEmail || "supplier@medistock.com").trim(),
      phone: (request.phone || request.contactPhone || "+1-555-0100").trim(),
      address: (request.address || "Main Medical Distribution Center").trim(),
      leadTimeDays: request.leadTimeDays ?? 5,
      isActive: request.isActive ?? true,
    };
    return apiRequest<SupplierItem>(`/api/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  // ── Purchase Orders ───────────────────────────────────────────────────────
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return apiRequest<PurchaseOrder[]>("/api/purchase-orders");
  },

  async getPurchaseOrderById(id: string): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}`);
  },

  async createPurchaseOrder(request: PurchaseOrderRequest): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>("/api/purchase-orders", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  async submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}/submit`, {
      method: "POST",
    });
  },

  async approvePurchaseOrder(id: string): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}/approve`, {
      method: "POST",
    });
  },

  async rejectPurchaseOrder(id: string, reason: string): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async requestRevision(id: string, reason: string): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>(`/api/purchase-orders/${id}/request-revision`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  // ── Approvals Console ─────────────────────────────────────────────────────
  async getPendingApprovals(facilityId?: string): Promise<PurchaseOrder[]> {
    const query = facilityId ? `?facilityId=${facilityId}` : "";
    return apiRequest<PurchaseOrder[]>(`/api/approvals/pending${query}`);
  },

  // ── Policy Validation ─────────────────────────────────────────────────────
  async validateProcurement(request: ValidateProcurementRequest): Promise<ValidateProcurementResponse> {
    return apiRequest<ValidateProcurementResponse>("/api/validation/procurement", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  async getAuthorizationRules(): Promise<PolicyRule[]> {
    return apiRequest<PolicyRule[]>("/api/validation/authorization-rules");
  },

  async getStorageRules(): Promise<PolicyRule[]> {
    return apiRequest<PolicyRule[]>("/api/validation/storage-rules");
  },

  // ── Deliveries ────────────────────────────────────────────────────────────
  async getDeliveryByPurchaseOrder(purchaseOrderId: string): Promise<Delivery | null> {
    try {
      return await apiRequest<Delivery>(`/api/deliveries/purchase-orders/${purchaseOrderId}`);
    } catch {
      return null;
    }
  },

  async createDelivery(
    purchaseOrderId: string,
    expectedAt?: string,
    trackingNumber?: string,
    notes?: string
  ): Promise<Delivery> {
    return apiRequest<Delivery>(`/api/deliveries/purchase-orders/${purchaseOrderId}`, {
      method: "POST",
      body: JSON.stringify({
        expectedAt: expectedAt ?? null,
        trackingNumber: trackingNumber ?? null,
        notes: notes ?? null,
        items: null,
      }),
    });
  },

  async markDelivered(
    deliveryId: string,
    items: DeliveryItem[]
  ): Promise<Delivery> {
    return apiRequest<Delivery>(`/api/deliveries/${deliveryId}/deliver`, {
      method: "POST",
      body: JSON.stringify({
        expectedAt: null,
        trackingNumber: null,
        notes: null,
        items,
      }),
    });
  },
};
