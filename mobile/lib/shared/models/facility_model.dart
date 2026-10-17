class FacilityModel {
  final String id;
  final String code;
  final String name;
  final String address;
  final String? city;
  final double latitude;
  final double longitude;
  final String type;

  FacilityModel({
    required this.id,
    required this.code,
    required this.name,
    required this.address,
    this.city,
    required this.latitude,
    required this.longitude,
    required this.type,
  });

  bool get hasValidCoordinates => latitude != 0.0 && longitude != 0.0;

  factory FacilityModel.fromJson(Map<String, dynamic> json) {
    return FacilityModel(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? json['facilityCode']?.toString() ?? '',
      name: json['name']?.toString() ??
          json['facilityName']?.toString() ??
          'Medical Facility',
      address: json['address']?.toString() ?? 'Not available',
      city: json['city']?.toString(),
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      type: json['type']?.toString() ??
          json['facilityType']?.toString() ??
          'Hospital',
    );
  }
}
