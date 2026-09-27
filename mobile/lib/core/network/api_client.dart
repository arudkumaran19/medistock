import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/paged_response.dart';
import '../storage/secure_storage.dart';
import 'auth_interceptor.dart';
import 'session_events.dart';

/// SHARED CORE - not owned by the Demand vertical.
///
/// Placeholder created by Sathurstiga S. (IT24103156) so the demand feature can call
/// the ASP.NET Core API. The mobile core owners replace this on integration.
///
/// Flutter never calls the internal agent service. Every request goes to the
/// authoritative ASP.NET Core API.
class ApiClient {
  ApiClient({Dio? dio, String? baseUrl})
      : dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl ?? defaultBaseUrl,
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 10),
                contentType: 'application/json',
              ),
            );

  /// 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
  /// A physical device needs the development machine's LAN address instead, and the
  /// API must then listen on all interfaces rather than loopback only.
  static const String defaultBaseUrl = 'http://10.0.2.2:5000';

  final Dio dio;

  /// Unwraps the frozen success envelope: { success, data }.
  static Map<String, dynamic> unwrap(Response<dynamic> response) {
    final dynamic body = response.data;

    if (body is Map<String, dynamic>) {
      final dynamic data = body['data'];

      if (data is Map<String, dynamic>) {
        return data;
      }

      return body;
    }

    throw const ApiFailure(
      code: 'UNEXPECTED_RESPONSE',
      message: 'The API returned an unexpected response.',
    );
  }

  /// Converts a Dio error into the agreed API error contract.
  static ApiFailure toFailure(Object error) {
    if (error is ApiFailure) {
      return error;
    }

    if (error is DioException) {
      final dynamic body = error.response?.data;

      if (body is Map<String, dynamic> && body['error'] != null) {
        return ApiFailure.fromJson(body);
      }

      if (error.response?.statusCode == 401) {
        return const ApiFailure(
          code: 'UNAUTHORIZED',
          message: 'Your session has expired. Please sign in again.',
        );
      }

      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.connectionError) {
        return const ApiFailure(
          code: 'NETWORK_UNAVAILABLE',
          message:
              'The server could not be reached. Check that the API is running and that '
              'the emulator can see it on 10.0.2.2:5000.',
        );
      }
    }

    return const ApiFailure(
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
    );
  }
}

/// The application's API client, with the bearer token attached automatically.
final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((Ref ref) {
  final SecureStorage storage = ref.watch(secureStorageProvider);
  final ApiClient client = ApiClient();

  client.dio.interceptors.add(
    AuthInterceptor(
      readToken: () async {
        final Map<String, dynamic>? session = await storage.readSession();
        return session?['accessToken'] as String?;
      },
      onUnauthorized: () async {
        await SessionEvents.onUnauthorized?.call();
      },
    ),
  );

  return client;
});
