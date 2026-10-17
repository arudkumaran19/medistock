import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../shared/models/inventory_model.dart';

class InventoryRepository {
  final Dio _dio;

  InventoryRepository(this._dio);

  Future<List<InventoryModel>> getAll({String? facilityId}) async {
    final resp = await _dio.get('/api/inventory', queryParameters: {
      if (facilityId != null) 'facilityId': facilityId,
    });

    final data = resp.data;
    List list = [];
    if (data is Map<String, dynamic> && data['data'] is List) {
      list = data['data'] as List;
    } else if (data is List) {
      list = data;
    }

    return list
        .map((j) => InventoryModel.fromJson(j as Map<String, dynamic>))
        .toList();
  }
}

final inventoryRepositoryProvider = Provider<InventoryRepository>((ref) {
  return InventoryRepository(DioClient().dio);
});

final inventoryListProvider = FutureProvider.autoDispose
    .family<List<InventoryModel>, String?>((ref, facilityId) async {
  return ref.watch(inventoryRepositoryProvider).getAll(facilityId: facilityId);
});
