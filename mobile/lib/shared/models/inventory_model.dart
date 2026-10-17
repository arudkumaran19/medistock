class InventoryModel {
  final String id;
  final String itemCode;
  final String name;
  final String category;
  final int quantityAvailable;
  final int minimumThreshold;
  final String unitOfMeasure;
  final String unit;
  final String unitDisplay;
  final String? packBreakdown;
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
    required this.unit,
    required this.unitDisplay,
    this.packBreakdown,
    this.nextExpiryDate,
    required this.status,
  });

  bool get isLowStock => quantityAvailable <= minimumThreshold;

  factory InventoryModel.fromJson(Map<String, dynamic> json) {
    final avail = (json['availableQuantity'] as num?)?.toInt() ??
        (json['quantityAvailable'] as num?)?.toInt() ??
        (json['quantityOnHand'] as num?)?.toInt() ??
        (json['quantity'] as num?)?.toInt() ??
        0;
    final minThresh = (json['minimumStockLevel'] as num?)?.toInt() ??
        (json['minimumThreshold'] as num?)?.toInt() ??
        (json['reorderLevel'] as num?)?.toInt() ??
        10;
    final isBelowMin = json['isBelowMinimum'] == true || avail <= minThresh;
    final statusStr =
        json['status']?.toString() ?? (isBelowMin ? 'LowStock' : 'Optimal');

    final unitVal = json['unit']?.toString() ??
        json['unitOfMeasure']?.toString() ??
        'units';
    final unitDisplayVal = json['unitDisplay']?.toString() ?? '$avail $unitVal';
    final packBreakdownVal = json['packBreakdown']?.toString();

    return InventoryModel(
      id: json['id']?.toString() ?? '',
      itemCode: json['itemCode']?.toString() ??
          json['code']?.toString() ??
          (json['medicineId'] != null
              ? 'MED-${json['medicineId'].toString().substring(0, 6).toUpperCase()}'
              : 'MED-001'),
      name: json['name']?.toString() ??
          json['medicineName']?.toString() ??
          json['itemName']?.toString() ??
          'Medicine Item',
      category: json['category']?.toString() ?? 'General',
      quantityAvailable: avail,
      minimumThreshold: minThresh,
      unitOfMeasure: unitVal,
      unit: unitVal,
      unitDisplay: unitDisplayVal,
      packBreakdown: packBreakdownVal,
      nextExpiryDate: json['nextExpiryDate'] != null
          ? DateTime.tryParse(json['nextExpiryDate'].toString())
          : (json['expiryDate'] != null
              ? DateTime.tryParse(json['expiryDate'].toString())
              : null),
      status: statusStr,
    );
  }
}
