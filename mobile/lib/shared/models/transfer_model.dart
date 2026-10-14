class TransferItemModel {
  final String id;
  final String inventoryItemId;
  final String itemName;
  final int requestedQuantity;
  final int? fulfilledQuantity;

  TransferItemModel({
    required this.id,
    required this.inventoryItemId,
    required this.itemName,
    required this.requestedQuantity,
    this.fulfilledQuantity,
  });

  factory TransferItemModel.fromJson(Map<String, dynamic> json) {
    return TransferItemModel(
      id: json['id']?.toString() ?? '',
      inventoryItemId: json['inventoryItemId']?.toString() ?? json['medicineId']?.toString() ?? '',
      itemName: json['itemName']?.toString() ?? json['medicineName']?.toString() ?? json['name']?.toString() ?? 'Medicine Item',
      requestedQuantity: (json['requestedQuantity'] as num?)?.toInt() ?? (json['quantity'] as num?)?.toInt() ?? 1,
      fulfilledQuantity: (json['fulfilledQuantity'] as num?)?.toInt() ?? (json['allocatedQuantity'] as num?)?.toInt() ?? (json['receivedQuantity'] as num?)?.toInt(),
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
    required this.items,
  });

  factory TransferModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return TransferModel(
      id: json['id']?.toString() ?? '',
      transferNumber: json['transferNumber']?.toString() ?? json['code']?.toString() ?? 'REQ-2024-8842',
      sourceFacilityId: json['sourceFacilityId']?.toString() ?? '',
      sourceFacilityName: json['sourceFacilityName']?.toString() ?? 'Regional Warehouse',
      destinationFacilityId: json['destinationFacilityId']?.toString() ?? '',
      destinationFacilityName: json['destinationFacilityName']?.toString() ?? 'Primary Health Center',
      status: json['status']?.toString() ?? 'Pending',
      priority: json['priority']?.toString() ?? 'Normal',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      officerName: json['officerName']?.toString() ?? 'Assigned Officer',
      officerPhone: json['officerPhone']?.toString() ?? '+91 98765 43210',
      currentLatitude: (json['currentLatitude'] as num?)?.toDouble() ?? (json['lastLatitude'] as num?)?.toDouble() ?? 13.0827,
      currentLongitude: (json['currentLongitude'] as num?)?.toDouble() ?? (json['lastLongitude'] as num?)?.toDouble() ?? 80.2707,
      otp: json['otp']?.toString() ?? '4829',
      items: rawItems.map((e) => TransferItemModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
