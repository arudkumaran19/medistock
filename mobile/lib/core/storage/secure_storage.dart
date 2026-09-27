import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// SHARED CORE - not owned by the Demand vertical.
///
/// Placeholder created by Sathurstiga S. (IT24103156) so the demand feature can hold a
/// session. The mobile core owners replace this on integration.
///
/// The token is kept in platform-encrypted storage (Keystore on Android), never in
/// plain shared preferences.
class SecureStorage {
  SecureStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  static const String _sessionKey = 'medistock.session';

  final FlutterSecureStorage _storage;

  Future<void> writeSession(Map<String, dynamic> session) async {
    await _storage.write(key: _sessionKey, value: jsonEncode(session));
  }

  Future<Map<String, dynamic>?> readSession() async {
    final String? raw = await _storage.read(key: _sessionKey);

    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } on FormatException {
      // Corrupted entry: drop it rather than crash on every launch.
      await clearSession();
      return null;
    }
  }

  Future<void> clearSession() async {
    await _storage.delete(key: _sessionKey);
  }
}

final Provider<SecureStorage> secureStorageProvider =
    Provider<SecureStorage>((Ref ref) => SecureStorage());
