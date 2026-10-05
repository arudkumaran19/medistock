import 'dart:async';
import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../storage/secure_storage.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor({Future<String?> Function()? readToken, this.onUnauthorized})
      : _readToken = readToken;

  final Future<String?> Function()? _readToken;
  final Future<void> Function()? onUnauthorized;
  final SecureStorage _storage = SecureStorage();

  Future<String?> _getToken() async {
    if (_readToken != null) {
      return await _readToken!();
    }
    return await _storage.read(key: 'auth_token');
  }

  /// For http-based API calls (Redistribution Slice)
  Future<Map<String, String>> getHeaders({Map<String, String>? extraHeaders}) async {
    final token = await _getToken();
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

  /// For Dio-based API calls (Demand & Shortage Slice)
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final String? token = await _getToken();

    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      await onUnauthorized?.call();
    }

    handler.next(err);
  }
}
