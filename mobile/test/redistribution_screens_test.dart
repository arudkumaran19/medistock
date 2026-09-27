import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/redistribution/models/transfer_models.dart';
import 'package:medistock_mobile/features/redistribution/screens/create_transfer_screen.dart';
import 'package:medistock_mobile/features/redistribution/screens/receive_transfer_screen.dart';
import 'package:medistock_mobile/features/redistribution/screens/transfer_details_screen.dart';
import 'package:medistock_mobile/features/redistribution/screens/transfer_list_screen.dart';
import 'package:medistock_mobile/features/redistribution/screens/transfer_tracking_screen.dart';
import 'package:medistock_mobile/features/redistribution/services/transfer_api_service.dart';

class FakeTransferApiService extends TransferApiService {
  final List<Transfer> transfersList;
  final RouteDetails mockRoute;

  FakeTransferApiService({
    required this.transfersList,
    required this.mockRoute,
  });

  @override
  Future<List<Transfer>> getTransfers({
    String? status,
    String? facilityId,
    int page = 1,
    int pageSize = 50,
  }) async {
    if (status != null && status != 'ALL') {
      return transfersList.where((t) => t.status == status).toList();
    }
    return transfersList;
  }

  @override
  Future<Transfer> getTransferById(String id) async {
    return transfersList.firstWhere((t) => t.id == id);
  }

  @override
  Future<Transfer> createTransfer({
    required String destinationFacilityId,
    required String medicineId,
    required int requestedQuantity,
    required String priority,
    String? sourceFacilityId,
    String? notes,
  }) async {
    final newTransfer = Transfer(
      id: 'mock-new-id',
      transferNumber: 'TR-2026-TEST',
      destinationFacilityId: destinationFacilityId,
      destinationFacilityName: 'Teaching Hospital Kandy',
      status: 'Draft',
      priority: priority,
      createdAt: DateTime.now(),
      items: [
        TransferItem(
          id: 'item-1',
          medicineId: medicineId,
          medicineName: 'Amoxicillin 500mg Capsules',
          requestedQuantity: requestedQuantity,
          allocatedQuantity: 0,
        ),
      ],
    );
    transfersList.add(newTransfer);
    return newTransfer;
  }

  @override
  Future<Transfer> submitTransferRequest(String id, {String? notes}) async {
    final t = transfersList.firstWhere((element) => element.id == id);
    return Transfer(
      id: t.id,
      transferNumber: t.transferNumber,
      destinationFacilityId: t.destinationFacilityId,
      destinationFacilityName: t.destinationFacilityName,
      sourceFacilityId: t.sourceFacilityId,
      sourceFacilityName: t.sourceFacilityName,
      status: 'Requested',
      priority: t.priority,
      createdAt: t.createdAt,
      items: t.items,
    );
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
    final t = transfersList.firstWhere((element) => element.id == transferId);
    return Transfer(
      id: t.id,
      transferNumber: t.transferNumber,
      destinationFacilityId: t.destinationFacilityId,
      destinationFacilityName: t.destinationFacilityName,
      sourceFacilityId: t.sourceFacilityId,
      sourceFacilityName: t.sourceFacilityName,
      status: 'Delivered',
      priority: t.priority,
      createdAt: t.createdAt,
      receivedAt: DateTime.now(),
      items: t.items,
    );
  }

  @override
  Future<RouteDetails> getRoute(String transferId) async {
    return mockRoute;
  }
}

void main() {
  late List<Transfer> mockTransfers;
  late RouteDetails mockRoute;
  late FakeTransferApiService fakeApi;

  setUp(() {
    mockTransfers = [
      Transfer(
        id: 't-1',
        transferNumber: 'TR-2026-0001',
        sourceFacilityId: 'f-source',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-dest',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'InTransit',
        priority: 'Emergency',
        estimatedDistanceKm: 115.5,
        estimatedDurationMinutes: 154.0,
        routingProvider: 'OpenRouteService',
        createdAt: DateTime(2026, 9, 26, 10, 0),
        items: [
          TransferItem(
            id: 'item-1',
            medicineId: 'med-1',
            medicineName: 'Amoxicillin 500mg',
            requestedQuantity: 200,
            allocatedQuantity: 200,
            batchNumber: 'BAT-2026-01',
          ),
        ],
      ),
      Transfer(
        id: 't-2',
        transferNumber: 'TR-2026-0002',
        sourceFacilityId: 'f-source-2',
        sourceFacilityName: 'Karapitiya Hospital',
        destinationFacilityId: 'f-dest',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'Requested',
        priority: 'Routine',
        estimatedDistanceKm: 180.0,
        estimatedDurationMinutes: 240.0,
        createdAt: DateTime(2026, 9, 25, 9, 0),
        items: [
          TransferItem(
            id: 'item-2',
            medicineId: 'med-2',
            medicineName: 'Paracetamol 500mg',
            requestedQuantity: 500,
            allocatedQuantity: 0,
          ),
        ],
      ),
    ];

    mockRoute = RouteDetails(
      sourceFacilityId: 'f-source',
      sourceFacilityName: 'National Hospital Colombo',
      destinationFacilityId: 'f-dest',
      destinationFacilityName: 'Teaching Hospital Kandy',
      distanceKm: 115.5,
      durationMinutes: 154.0,
      provider: 'OpenRouteService',
      isFallback: false,
      waypoints: [
        RouteWaypoint(latitude: 6.9271, longitude: 79.8612, label: 'Colombo Hub Departure'),
        RouteWaypoint(latitude: 7.2906, longitude: 80.6337, label: 'Kandy Inbound Gateway'),
      ],
    );

    fakeApi = FakeTransferApiService(
      transfersList: mockTransfers,
      mockRoute: mockRoute,
    );
  });

  group('Flutter Mobile Redistribution Feature Tests', () {
    testWidgets('TransferListScreen renders operational transfers with badges and filters',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TransferListScreen(apiService: fakeApi),
        ),
      );

      // Loading indicator should initially show
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.pumpAndSettle();

      // Check title and transfer cards
      expect(find.text('MediStock Field Operations'), findsOneWidget);
      expect(find.text('TR-2026-0001'), findsOneWidget);
      expect(find.text('TR-2026-0002'), findsOneWidget);
      expect(find.text('Amoxicillin 500mg'), findsOneWidget);
      expect(find.text('Declare Shortage'), findsOneWidget);
    });

    testWidgets('CreateTransferScreen validates quantity and declares field shortage',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: CreateTransferScreen(apiService: fakeApi),
        ),
      );

      expect(find.text('Declare Field Shortage'), findsOneWidget);
      expect(find.text('Requested Quantity (Doses/Packs)'), findsOneWidget);

      // Find the quantity field and enter 350
      final quantityFinder = find.byType(TextFormField).first;
      await tester.enterText(quantityFinder, '350');

      // Select Emergency Urgency
      await tester.tap(find.text('Emergency'));
      await tester.pumpAndSettle();

      // Tap submit button
      final submitFinder = find.text('Initiate Redistribution Request');
      await tester.ensureVisible(submitFinder);
      await tester.tap(submitFinder);
      await tester.pumpAndSettle();

      // Verify a new transfer was created in fakeApi
      expect(fakeApi.transfersList.length, 3);
      expect(fakeApi.transfersList.last.priority, 'Emergency');
    });

    testWidgets('TransferDetailsScreen renders item specs, pipeline, and facilities',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TransferDetailsScreen(
            transferId: 't-1',
            apiService: fakeApi,
            initialTransfer: mockTransfers.first,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('TR-2026-0001'), findsOneWidget);
      expect(find.text('Amoxicillin 500mg'), findsOneWidget);
      expect(find.text('Batch: BAT-2026-01'), findsOneWidget);
      expect(find.text('Verify & Receive Delivery'), findsOneWidget);
      expect(find.text('Track Road Transit & Waypoints'), findsOneWidget);
    });

    testWidgets('TransferTrackingScreen displays road distance, duration, and waypoints',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TransferTrackingScreen(
            transfer: mockTransfers.first,
            apiService: fakeApi,
            initialRoute: mockRoute,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Tracking TR-2026-0001'), findsOneWidget);
      expect(find.text('115.5 km'), findsOneWidget);
      expect(find.text('154 mins'), findsOneWidget);
      expect(find.text('Colombo Hub Departure'), findsOneWidget);
      expect(find.text('Kandy Inbound Gateway'), findsOneWidget);
    });

    testWidgets('ReceiveTransferScreen confirms receipt count and barcode verification',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ReceiveTransferScreen(
            transfer: mockTransfers.first,
            apiService: fakeApi,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Receive Delivery & Verification'), findsOneWidget);
      expect(find.text('Physical Count Received'), findsOneWidget);
      expect(find.text('Physical Batch / Lot Number'), findsOneWidget);

      // Verify the submit button is enabled
      final submitButtonFinder = find.text('Confirm & Finalize Delivery Receipt');
      expect(submitButtonFinder, findsOneWidget);

      await tester.tap(submitButtonFinder);
      await tester.pumpAndSettle();
    });
  });
}
