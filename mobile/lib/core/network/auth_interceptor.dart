import 'dart:async';
import '../constants/app_constants.dart';
import '../storage/secure_storage.dart';

class AuthInterceptor {
  final SecureStorage _storage = SecureStorage();

  Future<Map<String, String>> getHeaders({Map<String, String>? extraHeaders}) async {
    final token = await _storage.read(key: 'auth_token');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-User-Id': AppConstants.defaultFieldUserId,
    };

    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }

    return headers;
  }
}
