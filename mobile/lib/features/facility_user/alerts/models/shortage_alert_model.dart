class ShortageAlertModel {
  final String id;
  final String medicineId;
  final String medicineName;
  final String facilityId;
  final String facilityName;
  final int currentStock;
  final int suggestedQuantity;
  final String severity;
  final String message;
  final DateTime createdAt;
  final String status;
  final Map<String, dynamic> rawJson;

  ShortageAlertModel({
    required this.id,
    required this.medicineId,
    required this.medicineName,
    required this.facilityId,
    required this.facilityName,
    required this.currentStock,
    required this.suggestedQuantity,
    required this.severity,
    required this.message,
    required this.createdAt,
    this.status = 'OPEN',
    this.rawJson = const {},
  });

  factory ShortageAlertModel.fromJson(Map<String, dynamic> json) {
    final parsedStock =
        json['currentStock'] ?? json['stockOnHand'] ?? json['quantityOnHand'];
    final parsedQty = json['suggestedQuantity'] ??
        json['reorderQuantity'] ??
        json['shortageQuantity'] ??
        json['threshold'];
    final dateStr = json['createdAt']?.toString() ??
        json['generatedAt']?.toString() ??
        json['timestamp']?.toString() ??
        '';

    return ShortageAlertModel(
      id: json['id']?.toString() ?? '',
      medicineId: json['medicineId']?.toString() ?? '',
      medicineName: json['medicineName']?.toString() ??
          json['medicine']?['name']?.toString() ??
          'Medicine',
      facilityId: json['facilityId']?.toString() ?? '',
      facilityName: json['facilityName']?.toString() ??
          json['facility']?['name']?.toString() ??
          'Facility',
      currentStock: parsedStock is num
          ? parsedStock.toInt()
          : (int.tryParse(parsedStock?.toString() ?? '') ?? 0),
      suggestedQuantity: parsedQty is num
          ? parsedQty.toInt()
          : (int.tryParse(parsedQty?.toString() ?? '') ?? 100),
      severity: json['severity']?.toString() ??
          json['riskLevel']?.toString() ??
          'Medium',
      message: json['message']?.toString() ??
          json['reason']?.toString() ??
          'Shortage detected',
      createdAt: DateTime.tryParse(dateStr) ?? DateTime.now(),
      status: json['status']?.toString() ?? 'OPEN',
      rawJson: json,
    );
  }

  Map<String, dynamic> toJson() {
    final map = Map<String, dynamic>.from(rawJson);
    map.addAll({
      'id': id,
      'medicineId': medicineId,
      'medicineName': medicineName,
      'facilityId': facilityId,
      'facilityName': facilityName,
      'currentStock': currentStock,
      'suggestedQuantity': suggestedQuantity,
      'severity': severity,
      'riskLevel': severity,
      'message': message,
      'createdAt': createdAt.toIso8601String(),
      'generatedAt': createdAt.toIso8601String(),
      'status': status,
    });
    return map;
  }
}
