import 'dart:convert';
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
  final String baseUrl;
  final http.Client _httpClient;
  final AuthInterceptor _authInterceptor;

  ApiClient({
    String? baseUrl,
    http.Client? httpClient,
    AuthInterceptor? authInterceptor,
  })  : baseUrl = baseUrl ?? AppConstants.apiBaseUrl,
        _httpClient = httpClient ?? http.Client(),
        _authInterceptor = authInterceptor ?? AuthInterceptor();

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
        // Unwrap ApiResponse if present
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
            errorMessage = decoded['error'].toString();
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
