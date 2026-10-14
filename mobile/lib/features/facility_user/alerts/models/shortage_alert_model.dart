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
  });

  factory ShortageAlertModel.fromJson(Map<String, dynamic> json) {
    return ShortageAlertModel(
      id: json['id']?.toString() ?? '',
      medicineId: json['medicineId']?.toString() ?? '',
      medicineName: json['medicineName']?.toString() ?? json['medicine']?['name']?.toString() ?? 'Medicine',
      facilityId: json['facilityId']?.toString() ?? '',
      facilityName: json['facilityName']?.toString() ?? json['facility']?['name']?.toString() ?? 'Facility',
      currentStock: json['currentStock'] ?? json['stockOnHand'] ?? json['quantityOnHand'] ?? 0,
      suggestedQuantity: json['suggestedQuantity'] ?? json['reorderQuantity'] ?? json['shortageQuantity'] ?? json['threshold'] ?? 100,
      severity: json['severity']?.toString() ?? json['riskLevel']?.toString() ?? 'Medium',
      message: json['message']?.toString() ?? json['reason']?.toString() ?? 'Shortage detected',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? json['timestamp']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'medicineId': medicineId,
    'medicineName': medicineName,
    'facilityId': facilityId,
    'facilityName': facilityName,
    'currentStock': currentStock,
    'suggestedQuantity': suggestedQuantity,
    'severity': severity,
    'message': message,
    'createdAt': createdAt.toIso8601String(),
  };
}
