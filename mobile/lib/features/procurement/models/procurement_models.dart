class MobileSupplier {
  final String id;
  final String name;
  final String code;
  final String contactEmail;
  final String contactPhone;
  final bool isActive;

  MobileSupplier({
    required this.id,
    required this.name,
    required this.code,
    required this.contactEmail,
    required this.contactPhone,
    required this.isActive,
  });

  factory MobileSupplier.fromJson(Map<String, dynamic> json) {
    return MobileSupplier(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
      contactEmail: json['contactEmail'] as String? ?? '',
      contactPhone: json['contactPhone'] as String? ?? '',
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}

class MobilePurchaseOrderItem {
  final String? id;
  final String medicineId;
  final int requestedQuantity;
  final double unitPrice;

  MobilePurchaseOrderItem({
    this.id,
    required this.medicineId,
    required this.requestedQuantity,
    required this.unitPrice,
  });

  factory MobilePurchaseOrderItem.fromJson(Map<String, dynamic> json) {
    return MobilePurchaseOrderItem(
      id: json['id'] as String?,
      medicineId: json['medicineId'] as String? ?? '',
      requestedQuantity: (json['requestedQuantity'] as num?)?.toInt() ?? 0,
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'medicineId': medicineId,
        'requestedQuantity': requestedQuantity,
        'unitPrice': unitPrice,
      };
}

class MobilePurchaseOrder {
  final String id;
  final String supplierId;
  final String facilityId;
  final String status;
  final DateTime requestedAt;
  final DateTime? approvedAt;
  final String? rejectionReason;
  final String? revisionReason;
  final List<MobilePurchaseOrderItem> items;

  MobilePurchaseOrder({
    required this.id,
    required this.supplierId,
    required this.facilityId,
    required this.status,
    required this.requestedAt,
    this.approvedAt,
    this.rejectionReason,
    this.revisionReason,
    required this.items,
  });

  factory MobilePurchaseOrder.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return MobilePurchaseOrder(
      id: json['id'] as String? ?? '',
      supplierId: json['supplierId'] as String? ?? '',
      facilityId: json['facilityId'] as String? ?? '',
      status: json['status'] as String? ?? 'Draft',
      requestedAt: DateTime.tryParse(json['requestedAt'] as String? ?? '') ?? DateTime.now(),
      approvedAt: json['approvedAt'] != null ? DateTime.tryParse(json['approvedAt'] as String) : null,
      rejectionReason: json['rejectionReason'] as String?,
      revisionReason: json['revisionReason'] as String?,
      items: rawItems.map((e) => MobilePurchaseOrderItem.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  double get totalEstimatedCost =>
      items.fold(0.0, (sum, it) => sum + (it.requestedQuantity * it.unitPrice));

  int get totalQuantity =>
      items.fold(0, (sum, it) => sum + it.requestedQuantity);
}

class MobilePolicyValidationResult {
  final bool isValid;
  final String code;
  final String message;
  final bool requiresApproval;
  final String? approverRole;
  final List<String> warnings;

  MobilePolicyValidationResult({
    required this.isValid,
    required this.code,
    required this.message,
    required this.requiresApproval,
    this.approverRole,
    required this.warnings,
  });

  factory MobilePolicyValidationResult.fromJson(Map<String, dynamic> json) {
    final rawWarnings = json['warnings'] as List<dynamic>? ?? [];
    return MobilePolicyValidationResult(
      isValid: json['isValid'] as bool? ?? false,
      code: json['code'] as String? ?? '',
      message: json['message'] as String? ?? '',
      requiresApproval: json['requiresApproval'] as bool? ?? false,
      approverRole: json['approverRole'] as String?,
      warnings: rawWarnings.map((e) => e.toString()).toList(),
    );
  }
}

class MobileDelivery {
  final String id;
  final String purchaseOrderId;
  final String status;
  final DateTime? expectedAt;
  final DateTime? deliveredAt;
  final String? trackingNumber;
  final String? notes;

  MobileDelivery({
    required this.id,
    required this.purchaseOrderId,
    required this.status,
    this.expectedAt,
    this.deliveredAt,
    this.trackingNumber,
    this.notes,
  });

  factory MobileDelivery.fromJson(Map<String, dynamic> json) {
    return MobileDelivery(
      id: json['id'] as String? ?? '',
      purchaseOrderId: json['purchaseOrderId'] as String? ?? '',
      status: json['status'] as String? ?? 'Pending',
      expectedAt: json['expectedAt'] != null ? DateTime.tryParse(json['expectedAt'] as String) : null,
      deliveredAt: json['deliveredAt'] != null ? DateTime.tryParse(json['deliveredAt'] as String) : null,
      trackingNumber: json['trackingNumber'] as String?,
      notes: json['notes'] as String?,
    );
  }
}

