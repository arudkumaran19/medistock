import '../../../core/network/api_client.dart';
import '../models/inventory_models.dart';

class InventoryService { InventoryService([ApiClient? client]) : client = client ?? ApiClient(); final ApiClient client;
  Future<List<InventoryBalance>> list() async => (await client.request('/api/inventory') as List).map((x) => InventoryBalance.fromJson(x)).toList();
  Future<List<InventoryMedicine>> medicines({bool includeArchived = false}) async => (await client.request('/api/medicines${includeArchived ? '?includeArchived=true' : ''}') as List).map((x) => InventoryMedicine.fromJson(x)).toList();
  Future<InventoryMedicine> createMedicine({required String code, required String name, required String unit, required int minimumStockLevel}) async => InventoryMedicine.fromJson(await client.request('/api/medicines', method: 'POST', body: {'code': code, 'name': name, 'unit': unit, 'minimumStockLevel': minimumStockLevel}));
  Future<InventoryMedicine> updateMedicine(String id, {required String name, required String unit, required int minimumStockLevel}) async => InventoryMedicine.fromJson(await client.request('/api/medicines/$id', method: 'PUT', body: {'name': name, 'unit': unit, 'minimumStockLevel': minimumStockLevel}));
  Future<InventoryMedicine> archiveMedicine(String id, String reason) async => InventoryMedicine.fromJson(await client.request('/api/medicines/$id/archive', method: 'POST', body: {'reason': reason}));
  Future<List<InventoryFacility>> facilities() async => (await client.request('/api/facilities') as List).map((x) => InventoryFacility.fromJson(x)).toList();
  Future<List<MedicineBatch>> expiring({int days = 90}) async => (await client.request('/api/inventory/expiring?days=$days') as List).map((x) => MedicineBatch.fromJson(x)).toList();
  Future<MedicineBatch> lookupBatch(String batchNumber) async => MedicineBatch.fromJson(await client.request('/api/medicine-batches/lookup?batchNumber=${Uri.encodeComponent(batchNumber)}'));
  Future<void> receive({required String medicineId, required String facilityId, required String batchNumber, required int quantity, required DateTime expiry, required DateTime manufacturing}) async => client.request('/api/inventory/receive', method: 'POST', body: {'medicineId': medicineId, 'facilityId': facilityId, 'batchNumber': batchNumber, 'quantity': quantity, 'expiryDateUtc': expiry.toUtc().toIso8601String(), 'manufacturingDateUtc': manufacturing.toUtc().toIso8601String()});
  Future<void> adjust({required String medicineId, required String facilityId, required int delta, required String reason}) async => client.request('/api/inventory/adjust', method: 'POST', body: {'medicineId': medicineId, 'facilityId': facilityId, 'quantityDelta': delta, 'reason': reason});
  Future<MedicineBatch> retireBatch(String id, String reason) async => MedicineBatch.fromJson(await client.request('/api/medicine-batches/$id/retire', method: 'POST', body: {'reason': reason}));
}
