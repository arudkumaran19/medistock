import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../models/shortage_alert_model.dart';

class ShortageRepository {
  final Dio _dio;

  ShortageRepository(this._dio);

  Future<List<ShortageAlertModel>> getMyAlerts() async {
    final resp = await _dio.get('/api/shortages');
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
    return list.map((j) => ShortageAlertModel.fromJson(j as Map<String, dynamic>)).toList();
  }
}

final shortageRepositoryProvider = Provider<ShortageRepository>((ref) {
  return ShortageRepository(DioClient().dio);
});
