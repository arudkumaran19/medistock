import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient({String? baseUrl, String? authToken})
      : baseUrl = baseUrl ?? _resolveDefaultBaseUrl(),
        _instanceAuthToken = authToken;

  final String baseUrl;
  static String? globalAuthToken;
  final String? _instanceAuthToken;

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
    return 'http://localhost:5050';
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (authToken != null && authToken!.isNotEmpty)
        'Authorization': 'Bearer $authToken',
      if (extraHeaders != null) ...extraHeaders,
    };

    http.Response response;
    switch (method.toUpperCase()) {
      case 'POST':
        response = await http.post(uri, headers: headers, body: jsonEncode(body));
        break;
      case 'PUT':
        response = await http.put(uri, headers: headers, body: jsonEncode(body));
        break;
      case 'DELETE':
        response = await http.delete(uri, headers: headers);
        break;
      case 'GET':
      default:
        response = await http.get(uri, headers: headers);
        break;
    }

    if (response.statusCode == 204) {
      return {};
    }

    dynamic decoded;
    try {
      decoded = jsonDecode(response.body);
    } catch (_) {
      decoded = {'message': response.body};
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = decoded is Map
          ? (decoded['error']?['message'] ?? decoded['message'] ?? 'Request failed (${response.statusCode})')
          : 'Request failed (${response.statusCode})';
      throw Exception(msg);
    }

    if (decoded is Map && decoded.containsKey('data')) {
      return decoded['data'];
    }
    return decoded;
  }
}
