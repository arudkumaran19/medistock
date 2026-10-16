import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../models/shortage_alert_model.dart';

class ShortageRepository {
  final Dio _dio;

  ShortageRepository(this._dio);

  Future<List<ShortageAlertModel>> getMyAlerts({String? facilityId}) async {
    final Map<String, dynamic> query = {};
    if (facilityId != null && facilityId.isNotEmpty) {
      query['facilityId'] = facilityId;
    }

    final resp = await _dio.get(
      '/api/shortages',
      queryParameters: query.isNotEmpty ? query : null,
    );
    final data = resp.data;
    List list = [];
    if (data is Map<String, dynamic>) {
      if (data['data'] is List) {
        list = data['data'] as List;
      } else if (data['items'] is List) {
        list = data['items'] as List;
      } else if (data['data'] is Map && data['data']['items'] is List) {
        list = data['data']['items'] as List;
      }
    } else if (data is List) {
      list = data;
    }

    var alerts = list.map((j) => ShortageAlertModel.fromJson(j as Map<String, dynamic>)).toList();

    // Client-side facility scoping guard
    if (facilityId != null && facilityId.isNotEmpty) {
      alerts = alerts
          .where((a) =>
              a.facilityId.isEmpty ||
              a.facilityId.toLowerCase() == facilityId.toLowerCase())
          .toList();
    }

    return alerts;
  }

  Future<void> dismissShortage(String alertId, {String? reason}) async {
    await _dio.post(
      '/api/shortages/$alertId/dismiss',
      data: {'reason': reason ?? 'Dismissed as false positive'},
    );
  }
}

final shortageRepositoryProvider = Provider<ShortageRepository>((ref) {
  return ShortageRepository(DioClient().dio);
});
