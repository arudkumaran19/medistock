import 'package:dio/dio.dart';

/// SHARED CORE - not owned by the Demand vertical.
///
/// Placeholder created by Sathurstiga S. (IT24103156) so authenticated requests work.
/// The mobile core owners replace this on integration.
///
/// Attaches the bearer token to every outgoing request, and reports a rejected token
/// upward so the app can return to sign-in rather than showing an unexplained error on
/// every screen.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({required this.readToken, this.onUnauthorized});

  /// Supplies the current access token, or null when signed out.
  final Future<String?> Function() readToken;

  /// Invoked when the API rejects the token.
  final Future<void> Function()? onUnauthorized;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final String? token = await readToken();

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
