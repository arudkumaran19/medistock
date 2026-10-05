import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static final SecureStorageService _instance = SecureStorageService._internal();
  factory SecureStorageService() => _instance;
  SecureStorageService._internal();

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const String _keyToken = 'auth_token';
  static const String _keyRefreshToken = 'refresh_token';
  static const String _keyUser = 'user_data';
  static const String _keySelectedRole = 'selected_role';

  Future<void> saveToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: _keyToken);
  }

  Future<void> saveRefreshToken(String token) async {
    await _storage.write(key: _keyRefreshToken, value: token);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  Future<void> saveUser(Map<String, dynamic> user) async {
    await _storage.write(key: _keyUser, value: jsonEncode(user));
  }

  Future<Map<String, dynamic>?> getUser() async {
    final data = await _storage.read(key: _keyUser);
    if (data == null || data.isEmpty) return null;
    try {
      return jsonDecode(data) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSelectedRole(String role) async {
    await _storage.write(key: _keySelectedRole, value: role);
  }

  Future<String?> getSelectedRole() async {
    return await _storage.read(key: _keySelectedRole);
  }

  Future<void> deleteToken() async {
    await _storage.delete(key: _keyToken);
    await _storage.delete(key: _keyRefreshToken);
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
