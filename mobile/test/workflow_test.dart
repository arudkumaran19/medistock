import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/redistribution/models/transfer_models.dart';
import 'package:medistock_mobile/features/redistribution/screens/transfer_list_screen.dart';
import 'package:medistock_mobile/features/redistribution/services/transfer_api_service.dart';

class WorkflowMockApiService extends TransferApiService {
  final List<Transfer> database = [];

  WorkflowMockApiService() {
    database.add(
      Transfer(
        id: 'flow-transfer-001',
        transferNumber: 'TR-FLOW-001',
        sourceFacilityId: 'f-colombo',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-kandy',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'Reserved',
        priority: 'Urgent',
        estimatedDistanceKm: 115.5,
        estimatedDurationMinutes: 154.0,
        createdAt: DateTime.now(),
        items: [
          TransferItem(
            id: 'item-flow-1',
            medicineId: 'med-amox',
            medicineName: 'Amoxicillin 500mg',
            requestedQuantity: 300,
            allocatedQuantity: 300,
            batchNumber: 'BAT-FLOW-01',
          ),
        ],
      ),
    );
  }

  @override
  Future<List<Transfer>> getTransfers({
    String? status,
    String? facilityId,
    int page = 1,
    int pageSize = 50,
  }) async {
    if (status != null && status != 'ALL') {
      return database.where((t) => t.status == status).toList();
    }
    return List.from(database);
  }

  @override
  Future<Transfer> getTransferById(String id) async {
    return database.firstWhere((t) => t.id == id);
  }

  @override
  Future<Transfer> dispatchTransfer(
    String id, {
    String? notes,
    String? carrierName,
    String? trackingNumber,
  }) async {
    final idx = database.indexWhere((t) => t.id == id);
    if (idx != -1) {
      final old = database[idx];
      final updated = Transfer(
        id: old.id,
        transferNumber: old.transferNumber,
        sourceFacilityId: old.sourceFacilityId,
        sourceFacilityName: old.sourceFacilityName,
        destinationFacilityId: old.destinationFacilityId,
        destinationFacilityName: old.destinationFacilityName,
        status: 'InTransit',
        priority: old.priority,
        estimatedDistanceKm: old.estimatedDistanceKm,
        estimatedDurationMinutes: old.estimatedDurationMinutes,
        createdAt: old.createdAt,
        items: old.items,
      );
      database[idx] = updated;
      return updated;
    }
    throw Exception('Transfer not found');
  }

  @override
  Future<Transfer> receiveTransfer({
    required String transferId,
    required int receivedQuantity,
    required String batchNumber,
    required String destinationFacilityId,
    String? discrepancyReason,
    String? notes,
  }) async {
    final idx = database.indexWhere((t) => t.id == transferId);
    if (idx != -1) {
      final old = database[idx];
      final updated = Transfer(
        id: old.id,
        transferNumber: old.transferNumber,
        sourceFacilityId: old.sourceFacilityId,
        sourceFacilityName: old.sourceFacilityName,
        destinationFacilityId: old.destinationFacilityId,
        destinationFacilityName: old.destinationFacilityName,
        status: 'Delivered',
        priority: old.priority,
        estimatedDistanceKm: old.estimatedDistanceKm,
        estimatedDurationMinutes: old.estimatedDurationMinutes,
        createdAt: old.createdAt,
        receivedAt: DateTime.now(),
        items: old.items,
      );
      database[idx] = updated;
      return updated;
    }
    throw Exception('Transfer not found');
  }

  @override
  Future<RouteDetails> getRoute(String transferId) async {
    return RouteDetails(
      sourceFacilityId: 'f-colombo',
      sourceFacilityName: 'National Hospital Colombo',
      destinationFacilityId: 'f-kandy',
      destinationFacilityName: 'Teaching Hospital Kandy',
      distanceKm: 115.5,
      durationMinutes: 154.0,
      provider: 'OpenRouteService',
      isFallback: false,
      waypoints: [
        RouteWaypoint(latitude: 6.9271, longitude: 79.8612, label: 'Central Depot'),
        RouteWaypoint(latitude: 7.2906, longitude: 80.6337, label: 'Hospital Reception Bay'),
      ],
    );
  }
}

void main() {
  testWidgets('Field Officer Operations Workflow: Pickup (Reserved -> InTransit) -> Tracking -> Delivery (InTransit -> Delivered)',
      (tester) async {
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final mockApi = WorkflowMockApiService();

    // 1. Launch Mobile Application
    await tester.pumpWidget(
      MaterialApp(
        home: TransferListScreen(apiService: mockApi),
      ),
    );
    await tester.pumpAndSettle();

    // Verify existing Reserved transfer is displayed in operational list
    expect(find.text('TR-FLOW-001'), findsOneWidget);
    expect(find.text('Amoxicillin 500mg'), findsOneWidget);

    // 2. Open Transfer Details
    await tester.tap(find.text('TR-FLOW-001'));
    await tester.pumpAndSettle();

    expect(find.text('Transfer TR-FLOW-001'), findsOneWidget);
    expect(find.text('Confirm Pickup'), findsOneWidget);

    // 3. Confirm Pickup (Reserved -> InTransit)
    await tester.tap(find.text('Confirm Pickup'));
    await tester.pumpAndSettle();

    expect(mockApi.database.first.status, 'InTransit');
    expect(find.text('Confirm Delivery'), findsOneWidget);
    expect(find.text('Track Road Transit & Waypoints'), findsOneWidget);

    // 4. Open Live Transit Tracking
    await tester.tap(find.text('Track Road Transit & Waypoints'));
    await tester.pumpAndSettle();

    expect(find.text('Tracking TR-FLOW-001'), findsOneWidget);
    expect(find.text('115.5 km'), findsOneWidget);
    expect(find.text('Central Depot'), findsOneWidget);

    // Return to Transfer Details
    await tester.pageBack();
    await tester.pumpAndSettle();

    // 5. Open Delivery Confirmation & Verification
    await tester.tap(find.text('Confirm Delivery'));
    await tester.pumpAndSettle();

    expect(find.text('Confirm Delivery & Verification'), findsOneWidget);
    expect(find.text('Physical Count Received'), findsOneWidget);

    final confirmBtn = find.text('Confirm & Finalize Delivery Receipt');
    await tester.ensureVisible(confirmBtn);
    await tester.tap(confirmBtn);
    await tester.pumpAndSettle();

    // Verify status updated to Delivered
    expect(mockApi.database.first.status, 'Delivered');
  });
}
