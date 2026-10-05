class UserModel {
  final String id;
  final String email;
  final String name;
  final String role;
  final String? facilityId;
  final String? facilityName;

  UserModel({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.facilityId,
    this.facilityName,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? json['userId'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? json['fullName'] ?? json['email']?.split('@').first ?? 'User',
      role: json['role'] ?? (json['roles'] is List && (json['roles'] as List).isNotEmpty ? json['roles'][0] : 'FacilityUser'),
      facilityId: json['facilityId']?.toString(),
      facilityName: json['facilityName']?.toString() ?? 'Apollo Anna Nagar Hub',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'role': role,
        'facilityId': facilityId,
        'facilityName': facilityName,
      };
}
