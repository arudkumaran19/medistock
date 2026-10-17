class TransferItemModel {
  final String id;
  final String inventoryItemId;
  final String itemName;
  final int requestedQuantity;
  final int? fulfilledQuantity;
  final String unitOfMeasure;

  TransferItemModel({
    required this.id,
    required this.inventoryItemId,
    required this.itemName,
    required this.requestedQuantity,
    this.fulfilledQuantity,
    this.unitOfMeasure = 'units',
  });

  factory TransferItemModel.fromJson(Map<String, dynamic> json) {
    return TransferItemModel(
      id: json['id']?.toString() ?? '',
      inventoryItemId: json['inventoryItemId']?.toString() ?? json['medicineId']?.toString() ?? '',
      itemName: json['itemName']?.toString() ?? json['medicineName']?.toString() ?? json['name']?.toString() ?? 'Medicine Item',
      requestedQuantity: (json['requestedQuantity'] as num?)?.toInt() ?? (json['quantity'] as num?)?.toInt() ?? 1,
      fulfilledQuantity: (json['fulfilledQuantity'] as num?)?.toInt() ?? (json['allocatedQuantity'] as num?)?.toInt() ?? (json['receivedQuantity'] as num?)?.toInt(),
      unitOfMeasure: json['unitOfMeasure']?.toString() ?? json['unit']?.toString() ?? 'units',
    );
  }
}

class TransferModel {
  final String id;
  final String transferNumber;
  final String sourceFacilityId;
  final String sourceFacilityName;
  final String destinationFacilityId;
  final String destinationFacilityName;
  final String status; // Pending, Approved, InTransit, Delivered, Cancelled
  final String priority; // Normal, Urgent, Emergency
  final DateTime createdAt;
  final String? officerName;
  final String? officerPhone;
  final double currentLatitude;
  final double currentLongitude;
  final String? otp;
  final String? rejectionReason;
  final String? notes;
  final String? purchaseOrderId;
  final List<TransferItemModel> items;

  TransferModel({
    required this.id,
    required this.transferNumber,
    required this.sourceFacilityId,
    required this.sourceFacilityName,
    required this.destinationFacilityId,
    required this.destinationFacilityName,
    required this.status,
    required this.priority,
    required this.createdAt,
    this.officerName,
    this.officerPhone,
    required this.currentLatitude,
    required this.currentLongitude,
    this.otp,
    this.rejectionReason,
    this.notes,
    this.purchaseOrderId,
    required this.items,
  });

  String get primaryUnitOfMeasure {
    if (items.isNotEmpty && items.first.unitOfMeasure.isNotEmpty) {
      return items.first.unitOfMeasure;
    }
    return 'units';
  }

  factory TransferModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    final notes = json['notes']?.toString();
    String? poId = json['purchaseOrderId']?.toString();
    if (poId == null && notes != null) {
      final match = RegExp(r'\[PO:([0-9a-fA-F-]+)\]').firstMatch(notes);
      if (match != null) {
        poId = match.group(1);
      }
    }

    return TransferModel(
      id: json['id']?.toString() ?? '',
      transferNumber: json['transferNumber']?.toString() ?? json['code']?.toString() ?? '',
      sourceFacilityId: json['sourceFacilityId']?.toString() ?? '',
      sourceFacilityName: json['sourceFacilityName']?.toString() ?? 'Unknown Facility',
      destinationFacilityId: json['destinationFacilityId']?.toString() ?? '',
      destinationFacilityName: json['destinationFacilityName']?.toString() ?? 'Unknown Facility',
      status: json['status']?.toString() ?? 'Pending',
      priority: json['priority']?.toString() ?? 'Normal',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      officerName: json['officerName']?.toString(),
      officerPhone: json['officerPhone']?.toString(),
      currentLatitude: (json['currentLatitude'] as num?)?.toDouble() ?? (json['lastLatitude'] as num?)?.toDouble() ?? 0.0,
      currentLongitude: (json['currentLongitude'] as num?)?.toDouble() ?? (json['lastLongitude'] as num?)?.toDouble() ?? 0.0,
      otp: json['otp']?.toString(),
      rejectionReason: json['rejectionReason']?.toString(),
      notes: notes,
      purchaseOrderId: poId,
      items: rawItems.map((e) => TransferItemModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
