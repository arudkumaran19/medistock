class FacilityModel {
  final String id;
  final String code;
  final String name;
  final String address;
  final double latitude;
  final double longitude;
  final String type;

  FacilityModel({
    required this.id,
    required this.code,
    required this.name,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.type,
  });

  factory FacilityModel.fromJson(Map<String, dynamic> json) {
    return FacilityModel(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? json['facilityCode']?.toString() ?? 'FAC-01',
      name: json['name']?.toString() ?? json['facilityName']?.toString() ?? 'Medical Facility',
      address: json['address']?.toString() ?? 'Chennai Healthcare District',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 13.0827,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 80.2707,
      type: json['type']?.toString() ?? 'Hospital',
    );
  }
}
