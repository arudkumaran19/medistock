import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static final SecureStorage _instance = SecureStorage._internal();
  factory SecureStorage({FlutterSecureStorage? storage}) {
    if (storage != null) {
      return SecureStorage._withStorage(storage);
    }
    return _instance;
  }
  SecureStorage._internal()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        );
  SecureStorage._withStorage(this._storage);

  static const String _sessionKey = 'medistock.session';
  final FlutterSecureStorage _storage;

  Future<void> write({required String key, required String value}) async {
    await _storage.write(key: key, value: value);
  }

  Future<String?> read({required String key}) async {
    return await _storage.read(key: key);
  }

  Future<void> delete({required String key}) async {
    await _storage.delete(key: key);
  }

  Future<void> clear() async {
    await _storage.deleteAll();
  }

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
