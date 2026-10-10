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

class AuthException implements Exception {
  final String message;
  AuthException([this.message = 'Authentication token missing or invalid. Please login again.']);

  @override
  String toString() => 'AuthException: $message';
}
