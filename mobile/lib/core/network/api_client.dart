import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../constants/app_constants.dart';
import 'auth_interceptor.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic details;

  ApiException({
    required this.statusCode,
    required this.message,
    this.details,
  });

  @override
  String toString() => 'ApiException: $statusCode - $message';
}

class ApiClient {
  ApiClient({
    String? baseUrl,
    http.Client? httpClient,
    AuthInterceptor? authInterceptor,
    String? authToken,
  })  : baseUrl = baseUrl ?? _resolveDefaultBaseUrl(),
        _httpClient = httpClient ?? http.Client(),
        _authInterceptor = authInterceptor ?? AuthInterceptor(),
        _instanceAuthToken = authToken;

  final String baseUrl;
  static String? globalAuthToken;
  final String? _instanceAuthToken;
  final http.Client _httpClient;
  final AuthInterceptor _authInterceptor;

  String? get authToken => _instanceAuthToken ?? globalAuthToken;
  set authToken(String? token) {
    globalAuthToken = token;
  }

  static String _resolveDefaultBaseUrl() {
    const envUrl = String.fromEnvironment('API_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:5050';
    }
    return AppConstants.apiBaseUrl;
  }

  Uri _buildUri(String path, [Map<String, dynamic>? queryParameters]) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final fullUrl = '$baseUrl$cleanPath';
    final uri = Uri.parse(fullUrl);

    if (queryParameters != null && queryParameters.isNotEmpty) {
      final stringParams = queryParameters.map(
        (key, value) => MapEntry(key, value?.toString() ?? ''),
      );
      return uri.replace(queryParameters: stringParams);
    }
    return uri;
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
  }) async {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$baseUrl$cleanPath');
    final token = authToken;
    final headers = await _authInterceptor.getHeaders(extraHeaders: {
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
      if (extraHeaders != null) ...extraHeaders,
    });

    http.Response response;
    switch (method.toUpperCase()) {
      case 'POST':
        response = await _httpClient.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
        break;
      case 'PUT':
        response = await _httpClient.put(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
        break;
      case 'DELETE':
        response = await _httpClient.delete(uri, headers: headers);
        break;
      case 'GET':
      default:
        response = await _httpClient.get(uri, headers: headers);
        break;
    }

    return _handleResponse(response);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? queryParameters}) async {
    final uri = _buildUri(path, queryParameters);
    final headers = await _authInterceptor.getHeaders();
    final response = await _httpClient.get(uri, headers: headers);
    return _handleResponse(response);
  }

  Future<dynamic> post(String path, {dynamic body}) async {
    final uri = _buildUri(path);
    final headers = await _authInterceptor.getHeaders();
    final response = await _httpClient.post(
      uri,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<dynamic> put(String path, {dynamic body}) async {
    final uri = _buildUri(path);
    final headers = await _authInterceptor.getHeaders();
    final response = await _httpClient.put(
      uri,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty || response.statusCode == 204) {
        return null;
      }
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          if (decoded.containsKey('data')) {
            return decoded['data'];
          }
          if (decoded.containsKey('items')) {
            return decoded['items'];
          }
        }
        return decoded;
      } catch (e) {
        return response.body;
      }
    } else {
      String errorMessage = 'Request failed with status: ${response.statusCode}';
      dynamic errorDetails;
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          if (decoded['message'] != null && decoded['message'].toString().isNotEmpty) {
            errorMessage = decoded['message'].toString();
          } else if (decoded['title'] != null && decoded['title'].toString().isNotEmpty) {
            errorMessage = decoded['title'].toString();
          } else if (decoded['error'] != null && decoded['error'].toString().isNotEmpty) {
            if (decoded['error'] is Map && decoded['error']['message'] != null) {
              errorMessage = decoded['error']['message'].toString();
            } else {
              errorMessage = decoded['error'].toString();
            }
          }

          if (decoded['errors'] != null) {
            errorDetails = decoded['errors'];
            if (errorDetails is Map) {
              final msgs = errorDetails.values
                  .expand((v) => v is Iterable ? v : [v])
                  .map((e) => e.toString())
                  .join('; ');
              if (msgs.isNotEmpty) {
                errorMessage = '$errorMessage: $msgs';
              }
            } else if (errorDetails is List && errorDetails.isNotEmpty) {
              errorMessage = '$errorMessage: ${errorDetails.join(', ')}';
            }
          }
        }
      } catch (_) {
        errorMessage = response.body.isNotEmpty ? response.body : errorMessage;
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: errorMessage,
        details: errorDetails,
      );
    }
  }

  void close() {
    _httpClient.close();
  }
}
