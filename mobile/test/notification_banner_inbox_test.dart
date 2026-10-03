import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/redistribution/models/transfer_models.dart';
import 'package:medistock_mobile/features/redistribution/screens/notification_inbox_screen.dart';
import 'package:medistock_mobile/features/redistribution/screens/transfer_list_screen.dart';
import 'package:medistock_mobile/features/redistribution/services/transfer_api_service.dart';
import 'package:medistock_mobile/features/redistribution/services/transfer_signalr_service.dart';

class MockNotificationSignalRService implements TransferSignalRService {
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
    _connectionStateController.add(true);
  }

  @override
  Future<void> joinTransferGroup(String transferId) async {}

  @override
  Future<void> leaveTransferGroup(String transferId) async {}

  @override
  Future<void> disconnect() async {
    _connected = false;
    _connectionStateController.add(false);
  }

  @override
  void dispose() {
    _statusController.close();
    _locationController.close();
    _notificationController.close();
    _connectionStateController.close();
  }

  void emitNotificationCreated(TransferNotificationItem notification) {
    _notificationController.add(notification);
  }
}

class FakeNotificationApiService extends Fake implements TransferApiService {
  final List<TransferNotificationItem> notifications = [];
  bool markAsReadCalled = false;
  bool markAllAsReadCalled = false;

  @override
  Future<List<Transfer>> getTransfers({
    int page = 1,
    int pageSize = 20,
    String? status,
    String? facilityId,
  }) async {
    return [];
  }

  @override
  Future<List<TransferNotificationItem>> getNotifications({
    String? audience,
    String? transferId,
    bool unreadOnly = false,
    int page = 1,
    int pageSize = 20,
  }) async {
    if (unreadOnly) {
      return notifications.where((n) => !n.isRead).toList();
    }
    return List.from(notifications);
  }

  @override
  Future<TransferNotificationItem> markNotificationAsRead(String id) async {
    markAsReadCalled = true;
    final idx = notifications.indexWhere((n) => n.id == id);
    if (idx != -1) {
      final updated = notifications[idx].copyWith(isRead: true);
      notifications[idx] = updated;
      return updated;
    }
    return TransferNotificationItem(
      id: id,
      transferId: 'tr-0',
      audience: 'FieldOfficer',
      title: 'Read',
      message: 'Read',
      isRead: true,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<int> markAllNotificationsAsRead({String? audience}) async {
    markAllAsReadCalled = true;
    final count = notifications.where((n) => !n.isRead).length;
    for (var i = 0; i < notifications.length; i++) {
      notifications[i] = notifications[i].copyWith(isRead: true);
    }
    return count;
  }
}

void main() {
  group('Flutter Notification Tests (Banner & Inbox on Mock Event)', () {
    late FakeNotificationApiService fakeApi;
    late MockNotificationSignalRService mockSignalR;

    setUp(() {
      fakeApi = FakeNotificationApiService();
      mockSignalR = MockNotificationSignalRService();
    });

    tearDown(() {
      mockSignalR.dispose();
    });

    testWidgets(
        'renders bell icon and shows in-app SnackBar banner when NotificationCreated event arrives',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TransferListScreen(
            apiService: fakeApi,
            signalRService: mockSignalR,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify bell icon is present
      expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
      // No unread badge initially
      expect(find.text('1'), findsNothing);

      // Emit mock NotificationCreated event
      final mockNotif = TransferNotificationItem(
        id: 'notif-101',
        transferId: 'tr-test-101',
        audience: 'FieldOfficer',
        title: 'Your medicines are on the way',
        message: 'Field courier has picked up items and is en route.',
        isRead: false,
        createdAt: DateTime.now(),
      );

      mockSignalR.emitNotificationCreated(mockNotif);
      await tester.pump(); // Deliver stream event
      await tester.pump(const Duration(milliseconds: 300)); // Trigger SnackBar animation

      // In-app banner SnackBar should be displayed with title and message
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.text('Your medicines are on the way'), findsOneWidget);
      expect(
        find.text('Field courier has picked up items and is en route.'),
        findsOneWidget,
      );

      // Unread badge count on the bell should now display '1'
      expect(find.text('1'), findsOneWidget);
    });

    testWidgets(
        'tapping bell icon opens NotificationInboxScreen and allows marking notifications as read',
        (WidgetTester tester) async {
      fakeApi.notifications.add(
        TransferNotificationItem(
          id: 'notif-inbox-1',
          transferId: 'tr-inbox-1',
          audience: 'FieldOfficer',
          title: 'Medicines reserved',
          message: 'Medicines for TR-001 are reserved and packed.',
          isRead: false,
          createdAt: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: TransferListScreen(
            apiService: fakeApi,
            signalRService: mockSignalR,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Unread count badge '1' should show on the bell
      expect(find.text('1'), findsOneWidget);

      // Tap on the Notifications bell button
      await tester.tap(find.byTooltip('Notifications'));
      await tester.pumpAndSettle();

      // Verify we navigated to NotificationInboxScreen
      expect(find.byType(NotificationInboxScreen), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Medicines reserved'), findsOneWidget);
      expect(
        find.text('Medicines for TR-001 are reserved and packed.'),
        findsOneWidget,
      );

      // Mark all read button should be available
      expect(find.text('Mark All Read'), findsOneWidget);
      await tester.tap(find.text('Mark All Read'));
      await tester.pumpAndSettle();

      expect(fakeApi.markAllAsReadCalled, isTrue);
    });
  });
}
