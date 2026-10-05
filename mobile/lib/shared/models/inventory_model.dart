class InventoryModel {
  final String id;
  final String itemCode;
  final String name;
  final String category;
  final int quantityAvailable;
  final int minimumThreshold;
  final String unitOfMeasure;
  final DateTime? nextExpiryDate;
  final String status;

  InventoryModel({
    required this.id,
    required this.itemCode,
    required this.name,
    required this.category,
    required this.quantityAvailable,
    required this.minimumThreshold,
    required this.unitOfMeasure,
    this.nextExpiryDate,
    required this.status,
  });

  bool get isLowStock => quantityAvailable <= minimumThreshold;

  factory InventoryModel.fromJson(Map<String, dynamic> json) {
    return InventoryModel(
      id: json['id']?.toString() ?? '',
      itemCode: json['itemCode']?.toString() ?? json['code']?.toString() ?? 'MED-001',
      name: json['name']?.toString() ?? json['itemName']?.toString() ?? 'Medicine Item',
      category: json['category']?.toString() ?? 'General',
      quantityAvailable: (json['quantityAvailable'] ?? json['quantity'] ?? 0) as int,
      minimumThreshold: (json['minimumThreshold'] ?? json['reorderLevel'] ?? 10) as int,
      unitOfMeasure: json['unitOfMeasure']?.toString() ?? 'units',
      nextExpiryDate: json['nextExpiryDate'] != null ? DateTime.tryParse(json['nextExpiryDate'].toString()) : null,
      status: json['status']?.toString() ?? 'Normal',
    );
  }
}
