import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/redistribution/models/transfer_models.dart';
import 'package:medistock_mobile/features/redistribution/screens/transfer_details_screen.dart';
import 'package:medistock_mobile/features/redistribution/screens/transfer_tracking_screen.dart';
import 'package:medistock_mobile/features/redistribution/services/transfer_api_service.dart';
import 'package:medistock_mobile/features/redistribution/services/transfer_signalr_service.dart';

class MockTransferSignalRService implements TransferSignalRService {
  final StreamController<Transfer> _statusController =
      StreamController<Transfer>.broadcast();
  final StreamController<TransferLocationUpdate> _locationController =
      StreamController<TransferLocationUpdate>.broadcast();
  final StreamController<TransferNotificationItem> _notificationController =
      StreamController<TransferNotificationItem>.broadcast();
  final StreamController<bool> _connectionStateController =
      StreamController<bool>.broadcast();

  bool _connected = true;

  @override
  Stream<Transfer> get onTransferStatusChanged => _statusController.stream;

  @override
  Stream<TransferLocationUpdate> get onTransferLocationUpdated =>
      _locationController.stream;

  @override
  Stream<TransferNotificationItem> get onNotificationCreated =>
      _notificationController.stream;

  @override
  Stream<bool> get onConnectionStateChanged =>
      _connectionStateController.stream;

  @override
  bool get isConnected => _connected;

  @override
  Future<void> initAndConnect({String? transferId}) async {
    _connected = true;
    if (!_connectionStateController.isClosed) {
      _connectionStateController.add(true);
    }
  }

  @override
  Future<void> joinTransferGroup(String transferId) async {}

  @override
  Future<void> leaveTransferGroup(String transferId) async {}

  @override
  Future<void> disconnect() async {
    _connected = false;
    if (!_connectionStateController.isClosed) {
      _connectionStateController.add(false);
    }
  }

  @override
  void dispose() {
    _statusController.close();
    _locationController.close();
    _notificationController.close();
    _connectionStateController.close();
  }

  void emitStatusChange(Transfer transfer) {
    if (!_statusController.isClosed) _statusController.add(transfer);
  }

  void emitLocationUpdate(TransferLocationUpdate location) {
    if (!_locationController.isClosed) _locationController.add(location);
  }

  void emitNotificationCreated(TransferNotificationItem notification) {
    if (!_notificationController.isClosed) _notificationController.add(notification);
  }
}

class FakeTrackingApiService extends Fake implements TransferApiService {
  @override
  Future<Transfer> getTransferById(String id) async {
    throw UnimplementedError('Should not poll when SignalR socket is active');
  }

  @override
  Future<RouteDetails> getRoute(String id) async {
    return RouteDetails(
      sourceFacilityId: 'f-1',
      sourceFacilityName: 'National Hospital Colombo',
      destinationFacilityId: 'f-2',
      destinationFacilityName: 'Teaching Hospital Kandy',
      distanceKm: 115.5,
      durationMinutes: 154,
      provider: 'ORS',
      isFallback: false,
      waypoints: [
        RouteWaypoint(latitude: 6.9271, longitude: 79.8612, label: 'Origin'),
        RouteWaypoint(latitude: 7.2906, longitude: 80.6337, label: 'Destination'),
      ],
    );
  }
}

void main() {
  group('SignalR Live Tracking & Status Push Tests', () {
    late MockTransferSignalRService mockSignalR;
    late FakeTrackingApiService fakeApi;
    late Transfer baseTransfer;

    setUp(() {
      mockSignalR = MockTransferSignalRService();
      fakeApi = FakeTrackingApiService();
      baseTransfer = Transfer(
        id: 'trans-sig-01',
        transferNumber: 'TR-SIGNALR-001',
        sourceFacilityId: 'f-1',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'Reserved',
        priority: 'Urgent',
        createdAt: DateTime.now(),
        items: [
          TransferItem(
            id: 'item-1',
            medicineId: 'med-1',
            medicineName: 'Amoxicillin 500mg',
            requestedQuantity: 100,
            allocatedQuantity: 100,
          ),
        ],
      );
    });

    tearDown(() {
      mockSignalR.dispose();
    });

    testWidgets('TransferDetailsScreen updates immediately when SignalR status change fires',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TransferDetailsScreen(
            transferId: 'trans-sig-01',
            apiService: fakeApi,
            signalRService: mockSignalR,
            initialTransfer: baseTransfer,
            enablePolling: false,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Initial state is Reserved
      expect(find.text('RESERVED'), findsOneWidget);
      expect(find.text('Confirm Pickup'), findsOneWidget);
      expect(find.text('LIVE'), findsOneWidget);

      // Simulate real-time backend push: Field officer picked up -> InTransit
      final inTransitTransfer = Transfer(
        id: 'trans-sig-01',
        transferNumber: 'TR-SIGNALR-001',
        sourceFacilityId: 'f-1',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'InTransit',
        priority: 'Urgent',
        createdAt: baseTransfer.createdAt,
        items: baseTransfer.items,
      );

      mockSignalR.emitStatusChange(inTransitTransfer);

      // Pump to process stream event immediately (no 5s polling wait)
      await tester.pump(const Duration(milliseconds: 50));

      // Verify immediate UI update to INTRANSIT and Confirm Delivery button
      expect(find.text('INTRANSIT'), findsOneWidget);
      expect(find.text('Confirm Delivery'), findsOneWidget);
    });

    testWidgets('TransferTrackingScreen updates status immediately on SignalR push',
        (tester) async {
      final mockRoute = RouteDetails(
        sourceFacilityId: 'f-1',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        distanceKm: 115.5,
        durationMinutes: 154,
        provider: 'ORS',
        isFallback: false,
        waypoints: [
          RouteWaypoint(latitude: 6.9271, longitude: 79.8612, label: 'Origin'),
          RouteWaypoint(latitude: 7.2906, longitude: 80.6337, label: 'Destination'),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: TransferTrackingScreen(
            transfer: baseTransfer,
            apiService: fakeApi,
            signalRService: mockSignalR,
            initialRoute: mockRoute,
            enablePolling: false,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Tracking TR-SIGNALR-001'), findsOneWidget);
      expect(find.text('RESERVED'), findsOneWidget);

      // Emit status change to Delivered via SignalR
      final deliveredTransfer = Transfer(
        id: 'trans-sig-01',
        transferNumber: 'TR-SIGNALR-001',
        sourceFacilityId: 'f-1',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'Delivered',
        priority: 'Urgent',
        createdAt: baseTransfer.createdAt,
        items: baseTransfer.items,
      );

      mockSignalR.emitStatusChange(deliveredTransfer);
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('DELIVERED'), findsOneWidget);
    });

    testWidgets('TransferTrackingScreen updates live GPS coordinates when SignalR emits location update',
        (tester) async {
      final mockSignalR = MockTransferSignalRService();
      final fakeApi = FakeTrackingApiService();

      final inTransitTransfer = Transfer(
        id: 'trans-sig-02',
        transferNumber: 'TR-SIGNALR-002',
        sourceFacilityId: 'f-1',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'InTransit',
        priority: 'Urgent',
        createdAt: DateTime.now(),
        items: [],
      );

      final mockRoute = RouteDetails(
        sourceFacilityId: 'f-1',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        distanceKm: 115.4,
        durationMinutes: 180.0,
        provider: 'OpenRouteService',
        isFallback: false,
        waypoints: [],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: TransferTrackingScreen(
            transfer: inTransitTransfer,
            apiService: fakeApi,
            signalRService: mockSignalR,
            initialRoute: mockRoute,
            enablePolling: false,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Emit live GPS coordinates via SignalR
      mockSignalR.emitLocationUpdate(
        TransferLocationUpdate(
          transferId: 'trans-sig-02',
          latitude: 6.92715,
          longitude: 79.86124,
          speed: 45.0,
          heading: 90.0,
          timestamp: DateTime.now(),
        ),
      );

      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Live Field Officer GPS'), findsOneWidget);
      expect(find.textContaining('6.92715, 79.86124'), findsOneWidget);
    });

    testWidgets('TransferTrackingScreen renders 7-stage lifecycle timeline, Uber-Eats headline, and OSM map',
        (tester) async {
      final mockSignalR = MockTransferSignalRService();
      final fakeApi = FakeTrackingApiService();

      final inTransitTransfer = Transfer(
        id: 'trans-sig-03',
        transferNumber: 'TR-SIGNALR-003',
        sourceFacilityId: 'f-1',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'InTransit',
        priority: 'Urgent',
        createdAt: DateTime.now(),
        items: [],
      );

      final mockRoute = RouteDetails(
        sourceFacilityId: 'f-1',
        sourceFacilityName: 'National Hospital Colombo',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        distanceKm: 115.4,
        durationMinutes: 180.0,
        provider: 'OpenRouteService',
        isFallback: false,
        waypoints: [],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: TransferTrackingScreen(
            transfer: inTransitTransfer,
            apiService: fakeApi,
            signalRService: mockSignalR,
            initialRoute: mockRoute,
            enablePolling: false,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Uber-Eats Headline for InTransit (present in header banner and floating map card)
      expect(find.text('Your medicines are on the way'), findsAtLeastNWidgets(1));
      expect(find.text('Courier has picked up items and is delivering live'), findsOneWidget);

      // 7-Stage Lifecycle Stepper
      expect(find.text('Redistribution Progress'), findsOneWidget);
      expect(find.text('Stage 6 of 7'), findsOneWidget);
      expect(find.text('Shortage Declared'), findsOneWidget);
      expect(find.text('Supplies Requested'), findsOneWidget);
      expect(find.text('Candidate Proposed'), findsOneWidget);
      expect(find.text('Transfer Approved'), findsOneWidget);
      expect(find.text('Batch Reserved'), findsOneWidget);
      expect(find.text('Out for Delivery'), findsOneWidget);
      expect(find.text('Delivered'), findsAtLeastNWidgets(1));

      // OpenStreetMap attribution
      expect(find.text('© OpenStreetMap'), findsOneWidget);
    });

    testWidgets('TransferTrackingScreen displays in-app banner and increments bell badge when NotificationCreated fires',
        (tester) async {
      final mockSignalR = MockTransferSignalRService();
      final fakeApi = FakeTrackingApiService();

      final transfer = Transfer(
        id: 'trans-sig-04',
        transferNumber: 'TR-SIGNALR-004',
        destinationFacilityId: 'f-2',
        destinationFacilityName: 'Teaching Hospital Kandy',
        status: 'InTransit',
        priority: 'Urgent',
        createdAt: DateTime.now(),
        items: [],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: TransferTrackingScreen(
            transfer: transfer,
            apiService: fakeApi,
            signalRService: mockSignalR,
            enablePolling: false,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Emit NotificationCreated event via SignalR
      mockSignalR.emitNotificationCreated(
        TransferNotificationItem(
          id: 'notif-1',
          transferId: 'trans-sig-04',
          audience: 'FieldOfficer',
          title: 'Medicines delivered',
          message: 'Your medicines for TR-SIGNALR-004 have arrived.',
          isRead: false,
          createdAt: DateTime.now(),
        ),
      );

      // Pump to process stream
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump();

      // In-app SnackBar banner is shown
      expect(find.text('Medicines delivered'), findsOneWidget);
      expect(find.text('Your medicines for TR-SIGNALR-004 have arrived.'), findsOneWidget);
      expect(find.text('View'), findsOneWidget);

      // Bell badge shows 1
      expect(find.text('1'), findsOneWidget);
    });
  });
}
