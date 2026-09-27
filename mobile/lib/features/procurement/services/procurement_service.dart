import '../../../core/network/api_client.dart';
import '../models/procurement_models.dart';

class MobileProcurementService {
  MobileProcurementService({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<MobileSupplier>> getSuppliers({bool? isActive}) async {
    final path = isActive != null ? '/api/suppliers?isActive=$isActive' : '/api/suppliers';
    final res = await _client.request(path);
    if (res is List) {
      return res.map((e) => MobileSupplier.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<List<MobilePurchaseOrder>> getPurchaseOrders() async {
    final res = await _client.request('/api/purchase-orders');
    if (res is List) {
      return res.map((e) => MobilePurchaseOrder.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<List<MobilePurchaseOrder>> getPendingApprovals() async {
    final res = await _client.request('/api/approvals/pending');
    if (res is List) {
      return res.map((e) => MobilePurchaseOrder.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<MobilePurchaseOrder> createPurchaseOrder({
    required String supplierId,
    required String facilityId,
    required List<MobilePurchaseOrderItem> items,
  }) async {
    final body = {
      'supplierId': supplierId,
      'facilityId': facilityId,
      'items': items.map((e) => e.toJson()).toList(),
    };
    final res = await _client.request('/api/purchase-orders', method: 'POST', body: body);
    return MobilePurchaseOrder.fromJson(res as Map<String, dynamic>);
  }

  Future<MobilePurchaseOrder> submitPurchaseOrder(String id) async {
    final res = await _client.request('/api/purchase-orders/$id/submit', method: 'POST');
    return MobilePurchaseOrder.fromJson(res as Map<String, dynamic>);
  }

  Future<MobilePurchaseOrder> approvePurchaseOrder(String id) async {
    final res = await _client.request('/api/approvals/purchase-orders/$id/approve', method: 'POST');
    return MobilePurchaseOrder.fromJson(res as Map<String, dynamic>);
  }

  Future<MobilePurchaseOrder> rejectPurchaseOrder(String id, String reason) async {
    final res = await _client.request(
      '/api/approvals/purchase-orders/$id/reject',
      method: 'POST',
      body: {'reason': reason},
    );
    return MobilePurchaseOrder.fromJson(res as Map<String, dynamic>);
  }

  Future<MobilePurchaseOrder> requestRevision(String id, String reason) async {
    final res = await _client.request(
      '/api/approvals/purchase-orders/$id/request-revision',
      method: 'POST',
      body: {'reason': reason},
    );
    return MobilePurchaseOrder.fromJson(res as Map<String, dynamic>);
  }

  Future<MobilePolicyValidationResult> validateProcurement({
    required String facilityId,
    required String supplierId,
    required double totalCost,
    required int totalQuantity,
  }) async {
    final body = {
      'facilityId': facilityId,
      'supplierId': supplierId,
      'totalCost': totalCost,
      'totalQuantity': totalQuantity,
    };
    final res = await _client.request('/api/validation/procurement', method: 'POST', body: body);
    return MobilePolicyValidationResult.fromJson(res as Map<String, dynamic>);
  }

  Future<MobileDelivery?> getDeliveryByPurchaseOrder(String purchaseOrderId) async {
    try {
      final res = await _client.request('/api/deliveries/purchase-orders/$purchaseOrderId');
      if (res is Map<String, dynamic>) {
        return MobileDelivery.fromJson(res);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<MobileDelivery> createDelivery(
    String purchaseOrderId, {
    DateTime? expectedAt,
    String? trackingNumber,
    String? notes,
  }) async {
    final body = <String, dynamic>{
      if (expectedAt != null) 'expectedAt': expectedAt.toUtc().toIso8601String(),
      if (trackingNumber != null && trackingNumber.isNotEmpty) 'trackingNumber': trackingNumber,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };
    final res = await _client.request(
      '/api/deliveries/purchase-orders/$purchaseOrderId',
      method: 'POST',
      body: body,
    );
    return MobileDelivery.fromJson(res as Map<String, dynamic>);
  }

  Future<MobileDelivery> markDelivered(
    String deliveryId,
    List<Map<String, dynamic>> items,
  ) async {
    final res = await _client.request(
      '/api/deliveries/$deliveryId/deliver',
      method: 'POST',
      body: {'items': items},
    );
    return MobileDelivery.fromJson(res as Map<String, dynamic>);
  }
}

