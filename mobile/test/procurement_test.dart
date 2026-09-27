import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/procurement/models/procurement_models.dart';

void main() {
  group('Mobile Procurement Models', () {
    test('MobilePurchaseOrder parses correctly and calculates totals', () {
      final json = {
        'id': 'po-12345678-abcd',
        'supplierId': 'sup-1111',
        'facilityId': 'fac-2222',
        'status': 'PendingApproval',
        'requestedAt': '2026-09-27T00:00:00Z',
        'items': [
          {'medicineId': 'med-1', 'requestedQuantity': 100, 'unitPrice': 15.0},
          {'medicineId': 'med-2', 'requestedQuantity': 200, 'unitPrice': 10.0},
        ],
      };

      final order = MobilePurchaseOrder.fromJson(json);

      expect(order.id, 'po-12345678-abcd');
      expect(order.status, 'PendingApproval');
      expect(order.items.length, 2);
      expect(order.totalQuantity, 300);
      expect(order.totalEstimatedCost, 3500.0);
    });

    test('MobileSupplier parses valid and default properties', () {
      final json = {
        'id': 'sup-999',
        'name': 'Apex Pharma',
        'code': 'APX-01',
        'contactEmail': 'contact@apex.com',
        'contactPhone': '+123456',
        'isActive': true,
      };

      final supplier = MobileSupplier.fromJson(json);

      expect(supplier.id, 'sup-999');
      expect(supplier.name, 'Apex Pharma');
      expect(supplier.isActive, true);
    });

    test('MobilePolicyValidationResult parses warnings and approval flag', () {
      final json = {
        'isValid': true,
        'code': 'VALID_WITH_WARNINGS',
        'message': 'High value order requiring approval',
        'requiresApproval': true,
        'approverRole': 'FACILITY_MANAGER',
        'warnings': ['High value threshold exceeded', 'Bulk quantity check'],
      };

      final result = MobilePolicyValidationResult.fromJson(json);

      expect(result.isValid, true);
      expect(result.requiresApproval, true);
      expect(result.approverRole, 'FACILITY_MANAGER');
      expect(result.warnings.length, 2);
    });

    test('MobileDelivery parses tracking and delivery status', () {
      final json = {
        'id': 'del-1234',
        'purchaseOrderId': 'po-5678',
        'status': 'Delivered',
        'expectedAt': '2026-10-01T00:00:00Z',
        'deliveredAt': '2026-10-01T14:30:00Z',
        'trackingNumber': 'TRK-999',
        'notes': 'Delivered to main pharmacy warehouse',
      };

      final delivery = MobileDelivery.fromJson(json);

      expect(delivery.id, 'del-1234');
      expect(delivery.purchaseOrderId, 'po-5678');
      expect(delivery.status, 'Delivered');
      expect(delivery.trackingNumber, 'TRK-999');
      expect(delivery.deliveredAt, isNotNull);
    });
  });
}
