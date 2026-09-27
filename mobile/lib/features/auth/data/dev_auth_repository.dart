import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/session.dart';

/// TEMPORARY DEVELOPMENT SIGN-IN CLIENT. DELETE ON INTEGRATION.
///
/// Calls the development-only /api/dev/token endpoint, which the backend refuses to
/// serve outside the Development environment. Authentication is owned by
/// Vaisnavi L. (IT24102469) and her implementation replaces this file.
class DevAuthRepository {
  DevAuthRepository(this._client);

  final ApiClient _client;

  Future<Session> signIn(UserRole role) async {
    try {
      final Response<dynamic> response = await _client.dio.post<dynamic>(
        '/api/dev/token',
        data: <String, dynamic>{'role': role.wireValue},
      );

      return Session.fromJson(ApiClient.unwrap(response));
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }
}
