class UserModel {
  final String id;
  final String email;
  final String name;
  final String role;
  final String? facilityId;
  final String? facilityName;
  final List<Map<String, String>> facilities;

  UserModel({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.facilityId,
    this.facilityName,
    this.facilities = const [],
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawFacilities = json['facilities'];
    String? facName = json['facilityName']?.toString();
    String? facId = json['facilityId']?.toString();
    final parsedFacilities = <Map<String, String>>[];
    if (rawFacilities is List) {
      for (final item in rawFacilities) {
        if (item is Map) {
          final id = item['id']?.toString() ?? '';
          final name = item['name']?.toString() ?? '';
          parsedFacilities.add({'id': id, 'name': name});
          facId ??= id;
          facName ??= name;
        }
      }
    }

    return UserModel(
      id: json['id'] ?? json['userId'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ??
          json['fullName'] ??
          json['email']?.split('@').first ??
          'User',
      role: json['role'] ??
          (json['roles'] is List && (json['roles'] as List).isNotEmpty
              ? json['roles'][0]
              : 'FacilityUser'),
      facilityId: facId,
      facilityName: facName,
      facilities: parsedFacilities,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'role': role,
        'facilityId': facilityId,
        'facilityName': facilityName,
        'facilities': facilities,
      };
}
