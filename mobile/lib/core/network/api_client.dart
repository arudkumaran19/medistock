import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
	ApiClient({String? baseUrl}) : baseUrl = baseUrl ?? const String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:5000');
	final String baseUrl;

	Future<dynamic> request(String path, {String method = 'GET', Map<String, dynamic>? body}) async {
		final uri = Uri.parse('$baseUrl$path');
		final response = method == 'POST' ? await http.post(uri, headers: {'Content-Type': 'application/json'}, body: jsonEncode(body)) : await http.get(uri);
		final decoded = jsonDecode(response.body);
		if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(decoded['message'] ?? 'Request failed');
		return decoded['data'] ?? decoded;
	}
}
