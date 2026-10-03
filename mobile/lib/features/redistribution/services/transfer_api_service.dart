import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../models/transfer_models.dart';

class TransferApiService {
  final ApiClient _apiClient;

  TransferApiService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  // 1. GET /api/transfers
  Future<List<Transfer>> getTransfers({
    String? status,
    String? facilityId,
    int page = 1,
    int pageSize = 50,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (status != null && status.isNotEmpty && status != 'ALL') {
      queryParams['status'] = status;
    }
    if (facilityId != null && facilityId.isNotEmpty) {
      queryParams['facilityId'] = facilityId;
    }

    final response = await _apiClient.get('/api/transfers', queryParameters: queryParams);
    if (response is List) {
      return response
          .map((item) => Transfer.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  // 2. GET /api/transfers/{id}
  Future<Transfer> getTransferById(String id) async {
    final response = await _apiClient.get('/api/transfers/$id');
    if (response is Map<String, dynamic>) {
      return Transfer.fromJson(response);
    }
    throw ApiException(
      statusCode: 404,
      message: 'Failed to parse transfer details.',
    );
  }

  // 3. POST /api/transfers (Create Shortage / Transfer Declaration)
  Future<Transfer> createTransfer({
    required String destinationFacilityId,
    required String medicineId,
    required int requestedQuantity,
    required String priority,
    String? sourceFacilityId,
    String? notes,
  }) async {
    final payload = {
      'destinationFacilityId': destinationFacilityId,
      'medicineId': medicineId,
      'requestedQuantity': requestedQuantity,
      'priority': priority,
      'requestedByUserId': AppConstants.defaultFieldUserId,
      if (sourceFacilityId != null && sourceFacilityId.isNotEmpty)
        'sourceFacilityId': sourceFacilityId,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      'items': [
        {
          'medicineId': medicineId,
          'requestedQuantity': requestedQuantity,
        }
      ],
    };

    final response = await _apiClient.post('/api/transfers', body: payload);
    if (response is Map<String, dynamic>) {
      return Transfer.fromJson(response);
    }
    throw ApiException(
      statusCode: 500,
      message: 'Failed to create transfer.',
    );
  }

  // 4. POST /api/transfers/{id}/request (Submit Transfer Request)
  Future<Transfer> submitTransferRequest(String id, {String? notes}) async {
    final payload = {
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };
    final response = await _apiClient.post('/api/transfers/$id/request', body: payload);
    if (response is Map<String, dynamic>) {
      return Transfer.fromJson(response);
    }
    throw ApiException(
      statusCode: 500,
      message: 'Failed to submit transfer request.',
    );
  }

  // 4b. POST /api/transfers/{id}/dispatch (Dispatch Transfer)
  Future<Transfer> dispatchTransfer(String id, {String? notes, String? carrierName, String? trackingNumber}) async {
    final payload = {
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (carrierName != null && carrierName.isNotEmpty) 'carrierName': carrierName,
      if (trackingNumber != null && trackingNumber.isNotEmpty) 'trackingNumber': trackingNumber,
    };
    final response = await _apiClient.post('/api/transfers/$id/dispatch', body: payload);
    if (response is Map<String, dynamic>) {
      return Transfer.fromJson(response);
    }
    throw ApiException(
      statusCode: 500,
      message: 'Failed to dispatch transfer.',
    );
  }

  // 5. POST /api/transfers/{id}/receive (Receive Transfer & Log Discrepancies)
  Future<Transfer> receiveTransfer({
    required String transferId,
    required int receivedQuantity,
    required String batchNumber,
    required String destinationFacilityId,
    String? discrepancyReason,
    String? notes,
  }) async {
    final payload = {
      'receivedByUserId': AppConstants.defaultFieldUserId,
      'receivedQuantity': receivedQuantity,
      'batchNumber': batchNumber,
      'destinationFacilityId': destinationFacilityId,
      if (discrepancyReason != null && discrepancyReason.isNotEmpty)
        'discrepancyReason': discrepancyReason,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };

    final response = await _apiClient.post('/api/transfers/$transferId/receive', body: payload);
    if (response is Map<String, dynamic>) {
      return Transfer.fromJson(response);
    }
    throw ApiException(
      statusCode: 500,
      message: 'Failed to acknowledge transfer receipt.',
    );
  }

  // 6. GET /api/transfers/{id}/route (Live Route & Transit Waypoints)
  Future<RouteDetails> getRoute(String transferId) async {
    final response = await _apiClient.get('/api/transfers/$transferId/route');
    if (response is Map<String, dynamic>) {
      return RouteDetails.fromJson(response);
    }
    throw ApiException(
      statusCode: 404,
      message: 'Failed to load route transit details.',
    );
  }

  // 7. POST /api/transfers/{id}/location (Post live GPS coordinates during InTransit)
  Future<Transfer> updateLocation({
    required String transferId,
    required double latitude,
    required double longitude,
    double? speed,
    double? heading,
    DateTime? timestamp,
  }) async {
    final payload = {
      'latitude': latitude,
      'longitude': longitude,
      if (speed != null) 'speed': speed,
      if (heading != null) 'heading': heading,
      'timestamp': (timestamp ?? DateTime.now().toUtc()).toIso8601String(),
    };

    final response =
        await _apiClient.post('/api/transfers/$transferId/location', body: payload);
    if (response is Map<String, dynamic>) {
      return Transfer.fromJson(response);
    }
    throw ApiException(
      statusCode: 500,
      message: 'Failed to update transfer location.',
    );
  }

  // 8. GET /api/notifications
  Future<List<TransferNotificationItem>> getNotifications({
    String? audience,
    String? transferId,
    bool unreadOnly = false,
    int page = 1,
    int pageSize = 50,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
      'unreadOnly': unreadOnly,
    };
    if (audience != null && audience.isNotEmpty) {
      queryParams['audience'] = audience;
    }
    if (transferId != null && transferId.isNotEmpty) {
      queryParams['transferId'] = transferId;
    }

    final response =
        await _apiClient.get('/api/notifications', queryParameters: queryParams);
    if (response is List) {
      return response
          .map((item) => TransferNotificationItem.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  // 9. POST /api/notifications/{id}/read
  Future<void> markNotificationAsRead(String id) async {
    await _apiClient.post('/api/notifications/$id/read');
  }

  // 10. POST /api/notifications/read-all
  Future<void> markAllNotificationsAsRead({String? audience}) async {
    final path = (audience != null && audience.isNotEmpty)
        ? '/api/notifications/read-all?audience=$audience'
        : '/api/notifications/read-all';
    await _apiClient.post(path);
  }
}
