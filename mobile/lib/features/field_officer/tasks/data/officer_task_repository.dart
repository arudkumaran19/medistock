import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../shared/models/transfer_model.dart';

class PickupProof {
  final String? signature;
  final String? notes;
  final double? latitude;
  final double? longitude;

  PickupProof({this.signature, this.notes, this.latitude, this.longitude});

  Map<String, dynamic> toJson() => {
    if (signature != null) 'signature': signature,
    if (notes != null) 'notes': notes,
    if (latitude != null) 'latitude': latitude,
    if (longitude != null) 'longitude': longitude,
  };
}

class DeliveryProof {
  final String? signature;
  final String? recipientName;
  final String? notes;
  final double? latitude;
  final double? longitude;

  DeliveryProof({this.signature, this.recipientName, this.notes, this.latitude, this.longitude});

  Map<String, dynamic> toJson() => {
    if (signature != null) 'signature': signature,
    if (recipientName != null) 'recipientName': recipientName,
    if (notes != null) 'notes': notes,
    if (latitude != null) 'latitude': latitude,
    if (longitude != null) 'longitude': longitude,
  };
}

class OfficerTaskRepository {
  final Dio _dio;

  OfficerTaskRepository(this._dio);

  Future<List<TransferModel>> getAssignedTasks({int page = 1, int pageSize = 20}) async {
    final resp = await _dio.get('/api/transfers/assigned-to-me', queryParameters: {
      'page': page,
      'pageSize': pageSize,
    });

    final data = resp.data;
    List list = [];
    if (data is Map<String, dynamic>) {
      if (data['data'] is List) {
        list = data['data'] as List;
      } else if (data['data'] is Map && data['data']['items'] is List) {
        list = data['data']['items'] as List;
      } else if (data['items'] is List) {
        list = data['items'] as List;
      }
    } else if (data is List) {
      list = data;
    }

    return list.map((j) => TransferModel.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<void> acceptTask(String transferId) =>
      _dio.post('/api/transfers/$transferId/accept');

  Future<void> declineTask(String transferId, [String? notes]) =>
      _dio.post('/api/transfers/$transferId/decline', data: notes != null ? {'notes': notes} : null);

  Future<void> confirmPickup(String transferId, PickupProof proof) =>
      _dio.patch(
        '/api/transfers/$transferId/status',
        data: {'status': 'InTransit', 'proof': proof.toJson()},
      );

  Future<void> confirmDelivery(String transferId, DeliveryProof proof) =>
      _dio.patch(
        '/api/transfers/$transferId/status',
        data: {'status': 'Delivered', 'proof': proof.toJson()},
      );
}

final officerTaskRepositoryProvider = Provider<OfficerTaskRepository>((ref) {
  return OfficerTaskRepository(DioClient().dio);
});

final assignedTasksProvider = FutureProvider.autoDispose<List<TransferModel>>((ref) async {
  return ref.watch(officerTaskRepositoryProvider).getAssignedTasks();
});
