import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../shared/models/transfer_model.dart';
import '../../../redistribution/models/transfer_models.dart' show RouteDetails;

class CreateTransferRequest {
  final String destinationFacilityId;
  final String? sourceFacilityId;
  final String? medicineId;
  final String? medicineName;
  final int? requestedQuantity;
  final String? priority;
  final String? notes;
  final String? sourceShortageAlertId;
  final List<Map<String, dynamic>>? items;

  CreateTransferRequest({
    required this.destinationFacilityId,
    this.sourceFacilityId,
    this.medicineId,
    this.medicineName,
    this.requestedQuantity,
    this.priority,
    this.notes,
    this.sourceShortageAlertId,
    this.items,
  });

  Map<String, dynamic> toJson() => {
    'destinationFacilityId': destinationFacilityId,
    if (sourceFacilityId != null) 'sourceFacilityId': sourceFacilityId,
    if (medicineId != null) 'medicineId': medicineId,
    if (medicineName != null) 'medicineName': medicineName,
    if (requestedQuantity != null) 'requestedQuantity': requestedQuantity,
    if (priority != null) 'priority': priority,
    if (notes != null) 'notes': notes,
    if (sourceShortageAlertId != null) 'sourceShortageAlertId': sourceShortageAlertId,
    if (items != null) 'items': items,
  };
}

String toBackendStatus(String uiStatus) {
  const map = {
    'InTransit': 'Dispatched',
    'Delivered': 'Received',
    'Pending': 'Requested',
  };
  return map[uiStatus] ?? uiStatus;
}

class TransferRepository {
  final Dio _dio;

  TransferRepository(this._dio);

  Future<List<TransferModel>> getMyRequests({
    String? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    final backendStatus = status != null ? toBackendStatus(status) : null;
    final resp = await _dio.get('/api/transfers', queryParameters: {
      if (backendStatus != null && backendStatus != 'All' && backendStatus != 'ALL')
        'status': backendStatus,
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

  Future<TransferModel> createRequest(CreateTransferRequest req) async {
    final resp = await _dio.post('/api/transfers', data: req.toJson());
    final data = resp.data;
    final payload = (data is Map<String, dynamic> && data.containsKey('data')) ? data['data'] : data;
    return TransferModel.fromJson(payload as Map<String, dynamic>);
  }

  Future<TransferModel> submitRequest(String id, [String? notes]) async {
    final resp = await _dio.post('/api/transfers/$id/request', data: {
      if (notes != null) 'notes': notes,
    });
    final data = resp.data;
    final payload = (data is Map<String, dynamic> && data.containsKey('data')) ? data['data'] : data;
    return TransferModel.fromJson(payload as Map<String, dynamic>);
  }

  Future<TransferModel> confirmReceipt(String id, [String? notes]) async {
    final resp = await _dio.post('/api/transfers/$id/receive', data: {
      if (notes != null) 'notes': notes,
    });
    final data = resp.data;
    final payload = (data is Map<String, dynamic> && data.containsKey('data')) ? data['data'] : data;
    return TransferModel.fromJson(payload as Map<String, dynamic>);
  }

  Future<TransferModel> getById(String id) async {
    final resp = await _dio.get('/api/transfers/$id');
    final data = resp.data;
    final payload = (data is Map<String, dynamic> && data.containsKey('data')) ? data['data'] : data;
    return TransferModel.fromJson(payload as Map<String, dynamic>);
  }

  Future<RouteDetails?> getRoute(String id) async {
    try {
      final resp = await _dio.get('/api/transfers/$id/route');
      final data = resp.data;
      final payload = (data is Map<String, dynamic> && data.containsKey('data')) ? data['data'] : data;
      if (payload is Map<String, dynamic>) {
        return RouteDetails.fromJson(payload);
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}

final transferRepositoryProvider = Provider<TransferRepository>((ref) {
  return TransferRepository(DioClient().dio);
});

final myRequestsProvider = FutureProvider.autoDispose.family<List<TransferModel>, String?>((ref, status) async {
  return ref.watch(transferRepositoryProvider).getMyRequests(status: status);
});

final transferByIdProvider = FutureProvider.autoDispose.family<TransferModel, String>((ref, id) async {
  return ref.watch(transferRepositoryProvider).getById(id);
});

final transferRouteProvider = FutureProvider.autoDispose.family<RouteDetails?, String>((ref, id) async {
  return ref.watch(transferRepositoryProvider).getRoute(id);
});
