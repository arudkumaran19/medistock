/// TEMPORARY DEVELOPMENT SESSION MODEL. DELETE ON INTEGRATION.
///
/// Authentication is owned by Vaisnavi L. (IT24102469). Her real sign-in replaces this.
library;

/// The four roles defined by the blueprint.
enum UserRole {
  storeOfficer('STORE_OFFICER', 'Store Officer'),
  facilityManager('FACILITY_MANAGER', 'Facility Manager'),
  supplierOfficer('SUPPLIER_OFFICER', 'Supplier Officer'),
  admin('ADMIN', 'Administrator');

  const UserRole(this.wireValue, this.label);

  /// Value the API uses.
  final String wireValue;

  /// Human-readable name.
  final String label;

  static UserRole fromWire(String value) {
    return UserRole.values.firstWhere(
      (UserRole role) => role.wireValue == value,
      orElse: () => UserRole.storeOfficer,
    );
  }
}

/// A signed-in session.
class Session {
  const Session({
    required this.accessToken,
    required this.role,
    required this.displayName,
    required this.expiresAt,
  });

  final String accessToken;
  final UserRole role;
  final String displayName;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      accessToken: json['accessToken'] as String,
      role: UserRole.fromWire(json['role'] as String),
      displayName: json['displayName'] as String? ?? 'User',
      expiresAt: DateTime.parse(json['expiresAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'accessToken': accessToken,
        'role': role.wireValue,
        'displayName': displayName,
        'expiresAt': expiresAt.toIso8601String(),
      };
}
