import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../storage/secure_storage.dart';
import 'api_exceptions.dart';
import 'auth_interceptor.dart';

class ApiClient {
  ApiClient({
    String? baseUrl,
    http.Client? httpClient,
    AuthInterceptor? authInterceptor,
    String? authToken,
  })  : baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        _httpClient = httpClient ?? http.Client(),
        _authInterceptor = authInterceptor ?? AuthInterceptor(),
        _instanceAuthToken = authToken;

  final String baseUrl;
  final http.Client _httpClient;
  final AuthInterceptor _authInterceptor;
  final SecureStorageService _storage = SecureStorageService();

  static String? globalAuthToken;
  final String? _instanceAuthToken;

  String? get authToken => _instanceAuthToken ?? globalAuthToken;
  set authToken(String? token) {
    globalAuthToken = token;
    if (token != null) {
      _storage.saveToken(token);
    }
  }

  Future<String?> _getOrRequireToken({bool requireAuth = true}) async {
    final token = await _storage.getToken() ?? authToken;
    if (requireAuth && (token == null || token.isEmpty)) {
      throw AuthException('No authentication token found. Please log in.');
    }
    return token;
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

  Future<Map<String, String>> _getHeaders({bool requireAuth = true, Map<String, String>? extraHeaders}) async {
    final token = await _getOrRequireToken(requireAuth: requireAuth);
    final headers = await _authInterceptor.getHeaders(extraHeaders: extraHeaders);
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    dynamic body,
    Map<String, String>? extraHeaders,
  }) async {
    final uri = _buildUri(path);
    final headers = await _getHeaders(requireAuth: false, extraHeaders: extraHeaders);

    http.Response response;
    final encodedBody = body != null ? jsonEncode(body) : null;

    switch (method.toUpperCase()) {
      case 'POST':
        response = await _httpClient.post(uri, headers: headers, body: encodedBody);
        break;
      case 'PUT':
        response = await _httpClient.put(uri, headers: headers, body: encodedBody);
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

  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    bool requireAuth = true,
  }) async {
    final uri = _buildUri(path, queryParameters);
    final headers = await _getHeaders(requireAuth: requireAuth);
    final response = await _httpClient.get(uri, headers: headers);
    return _handleResponse(response);
  }

  Future<dynamic> post(
    String path, {
    dynamic body,
    bool requireAuth = true,
  }) async {
    final uri = _buildUri(path);
    final headers = await _getHeaders(requireAuth: requireAuth);
    final response = await _httpClient.post(
      uri,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<dynamic> put(
    String path, {
    dynamic body,
    bool requireAuth = true,
  }) async {
    final uri = _buildUri(path);
    final headers = await _getHeaders(requireAuth: requireAuth);
    final response = await _httpClient.put(
      uri,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<dynamic> delete(
    String path, {
    bool requireAuth = true,
  }) async {
    final uri = _buildUri(path);
    final headers = await _getHeaders(requireAuth: requireAuth);
    final response = await _httpClient.delete(uri, headers: headers);
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
