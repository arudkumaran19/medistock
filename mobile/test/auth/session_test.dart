import 'package:flutter_test/flutter_test.dart';
import 'package:medistock/features/auth/domain/session.dart';

/// Session model tests.
/// Sathurstiga S. (IT24103156).
///
/// Covers the temporary development session. Vaisnavi L.'s real authentication
/// replaces both the model and these tests.
void main() {
  Map<String, dynamic> json({
    String role = 'FACILITY_MANAGER',
    required DateTime expiresAt,
  }) {
    return <String, dynamic>{
      'accessToken': 'token-abc',
      'role': role,
      'displayName': 'dev-facility_manager',
      'expiresAt': expiresAt.toIso8601String(),
    };
  }

  group('UserRole', () {
    test('maps every wire value the API can return', () {
      expect(UserRole.fromWire('STORE_OFFICER'), UserRole.storeOfficer);
      expect(UserRole.fromWire('FACILITY_MANAGER'), UserRole.facilityManager);
      expect(UserRole.fromWire('SUPPLIER_OFFICER'), UserRole.supplierOfficer);
      expect(UserRole.fromWire('ADMIN'), UserRole.admin);
    });

    test('falls back to the least privileged role for an unknown value', () {
      // An unrecognised role must never be treated as an administrator.
      expect(UserRole.fromWire('SUPER_USER'), UserRole.storeOfficer);
    });

    test('carries a human readable label', () {
      expect(UserRole.facilityManager.label, 'Facility Manager');
    });
  });

  group('Session', () {
    test('parses the dev token response', () {
      final Session session = Session.fromJson(
        json(expiresAt: DateTime.now().add(const Duration(hours: 8))),
      );

      expect(session.accessToken, 'token-abc');
      expect(session.role, UserRole.facilityManager);
      expect(session.isExpired, isFalse);
    });

    test('reports an expired session', () {
      final Session session = Session.fromJson(
        json(expiresAt: DateTime.now().subtract(const Duration(minutes: 1))),
      );

      expect(session.isExpired, isTrue);
    });

    test('survives a storage round trip', () {
      final DateTime expiry = DateTime.now().add(const Duration(hours: 4));
      final Session original = Session.fromJson(json(expiresAt: expiry));

      final Session restored = Session.fromJson(original.toJson());

      expect(restored.accessToken, original.accessToken);
      expect(restored.role, original.role);
      expect(restored.displayName, original.displayName);
      expect(
        restored.expiresAt.toIso8601String(),
        original.expiresAt.toIso8601String(),
      );
    });
  });
}
