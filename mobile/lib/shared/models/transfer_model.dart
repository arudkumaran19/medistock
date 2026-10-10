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
      inventoryItemId: json['inventoryItemId']?.toString() ?? '',
      itemName: json['itemName']?.toString() ?? json['name']?.toString() ?? 'Medicine Item',
      requestedQuantity: (json['requestedQuantity'] ?? json['quantity'] ?? 1) as int,
      fulfilledQuantity: json['fulfilledQuantity'] as int?,
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
      sourceFacilityName: json['sourceFacilityName']?.toString() ?? 'Tambaram Regional Depot',
      destinationFacilityId: json['destinationFacilityId']?.toString() ?? '',
      destinationFacilityName: json['destinationFacilityName']?.toString() ?? 'Apollo Anna Nagar Hub',
      status: json['status']?.toString() ?? 'Pending',
      priority: json['priority']?.toString() ?? 'Normal',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      officerName: json['officerName']?.toString() ?? 'Rajesh Kumar',
      officerPhone: json['officerPhone']?.toString() ?? '+91 98765 43210',
      currentLatitude: (json['currentLatitude'] as num?)?.toDouble() ?? 13.0827,
      currentLongitude: (json['currentLongitude'] as num?)?.toDouble() ?? 80.2707,
      otp: json['otp']?.toString() ?? '4829',
      items: rawItems.map((e) => TransferItemModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
