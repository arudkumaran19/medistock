import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/auth/domain/auth_state.dart';
import 'package:medistock_mobile/features/auth/presentation/auth_controller.dart';
import 'package:medistock_mobile/features/facility_user/alerts/alerts_provider.dart';
import 'package:medistock_mobile/features/facility_user/alerts/alerts_screen.dart';
import 'package:medistock_mobile/features/facility_user/alerts/data/shortage_repository.dart';
import 'package:medistock_mobile/features/facility_user/alerts/models/shortage_alert_model.dart';
import 'package:medistock_mobile/features/facility_user/alerts/verify_shortage_screen.dart';
import 'package:medistock_mobile/features/facility_user/dashboard/user_home_screen.dart';
import 'package:medistock_mobile/shared/models/user_model.dart';
import 'package:medistock_mobile/features/facility_user/requests/request_detail_screen.dart';
import 'package:medistock_mobile/features/facility_user/requests/data/transfer_repository.dart';
import 'package:medistock_mobile/shared/models/transfer_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FakeShortageRepository implements ShortageRepository {
  List<ShortageAlertModel> alerts;
  bool throw403OnDismiss = false;

  FakeShortageRepository(this.alerts);

  @override
  Future<List<ShortageAlertModel>> getMyAlerts({String? facilityId}) async {
    if (facilityId != null && facilityId.isNotEmpty) {
      return alerts
          .where((a) =>
              a.facilityId.isEmpty ||
              a.facilityId.toLowerCase() == facilityId.toLowerCase())
          .toList();
    }
    return List.from(alerts);
  }

  @override
  Future<void> dismissShortage(String alertId, {String? reason}) async {
    if (throw403OnDismiss) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/shortages/$alertId/dismiss'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/shortages/$alertId/dismiss'),
          statusCode: 403,
          data: {
            'error': {
              'code': 'FORBIDDEN',
              'message': 'You can only dismiss shortage alerts for your own assigned facility.'
            }
          },
        ),
      );
    }
    alerts.removeWhere((a) => a.id == alertId);
  }
}

class FakeAuthController extends StateNotifier<AuthState> implements AuthController {
  FakeAuthController(UserModel? user)
      : super(AuthState(
          status: user != null ? AuthStatus.authenticated : AuthStatus.unauthenticated,
          user: user,
          selectedRole: user?.role,
        ));

  @override
  Future<void> checkAuthStatus() async {}

  @override
  void selectRole(String role) {}

  @override
  Future<bool> login({required String email, required String password}) async => true;

  @override
  Future<void> logout() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const testFacilityId = 'a0000000-0000-0000-0000-000000000001';

  final alertOld = ShortageAlertModel(
    id: 'alert-1',
    medicineId: 'med-1',
    medicineName: 'Paracetamol 500mg',
    facilityId: testFacilityId,
    facilityName: 'National Hospital',
    currentStock: 50,
    suggestedQuantity: 200,
    severity: 'MEDIUM',
    message: 'Stock low',
    createdAt: DateTime.now().subtract(const Duration(hours: 3)),
  );

  final alertNewer = ShortageAlertModel(
    id: 'alert-2',
    medicineId: 'med-2',
    medicineName: 'Amoxicillin 250mg',
    facilityId: testFacilityId,
    facilityName: 'National Hospital',
    currentStock: 10,
    suggestedQuantity: 500,
    severity: 'HIGH',
    message: 'Critical stockout projected',
    createdAt: DateTime.now().subtract(const Duration(minutes: 10)),
  );

  setUp(() {
    SharedPreferences.setMockInitialValues({'opened_shortage_alert_ids': <String>[]});
  });

  testWidgets('Alerts are sorted by createdAt descending (newest first)', (tester) async {
    final fakeRepo = FakeShortageRepository([alertOld, alertNewer]);
    final container = ProviderContainer(
      overrides: [
        shortageRepositoryProvider.overrideWithValue(fakeRepo),
        authControllerProvider.overrideWith((ref) => FakeAuthController(
              UserModel(
                id: 'u1',
                email: 'store@medistock.com',
                name: 'Store Officer',
                role: 'STORE_OFFICER',
                facilityId: testFacilityId,
                facilityName: 'National Hospital',
              ),
            )),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: AlertsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final titles = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).toList();
    final indexNewer = titles.indexOf('Shortage Risk: Amoxicillin 250mg');
    final indexOld = titles.indexOf('Shortage Risk: Paracetamol 500mg');

    expect(indexNewer, isNonNegative);
    expect(indexOld, isNonNegative);
    expect(indexNewer, lessThan(indexOld), reason: 'Newer alert must appear before older alert');
  });

  testWidgets('Unopened alerts display NEW chip and chip disappears once opened', (tester) async {
    SharedPreferences.setMockInitialValues({'opened_shortage_alert_ids': ['alert-1']});

    final fakeRepo = FakeShortageRepository([alertOld, alertNewer]);
    final container = ProviderContainer(
      overrides: [
        shortageRepositoryProvider.overrideWithValue(fakeRepo),
        authControllerProvider.overrideWith((ref) => FakeAuthController(
              UserModel(
                id: 'u1',
                email: 'store@medistock.com',
                name: 'Store Officer',
                role: 'STORE_OFFICER',
                facilityId: testFacilityId,
                facilityName: 'National Hospital',
              ),
            )),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: AlertsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // alert-2 is unread, so exactly one NEW chip should be visible
    expect(find.byKey(const Key('new-alert-chip')), findsOneWidget);

    // Mark alert-2 as opened
    await container.read(openedAlertsProvider.notifier).markAsOpened('alert-2');
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('new-alert-chip')), findsNothing);
  });

  testWidgets('Dashboard displays notification banner and bell badge for unread alerts', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final fakeRepo = FakeShortageRepository([alertOld, alertNewer]);
    final container = ProviderContainer(
      overrides: [
        shortageRepositoryProvider.overrideWithValue(fakeRepo),
        authControllerProvider.overrideWith((ref) => FakeAuthController(
              UserModel(
                id: 'u1',
                email: 'store@medistock.com',
                name: 'Store Officer',
                role: 'STORE_OFFICER',
                facilityId: testFacilityId,
                facilityName: 'National Hospital',
              ),
            )),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: UserHomeScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    // Bell badge should show unread count 2
    expect(find.byKey(const Key('unread-alert-badge')), findsOneWidget);
    expect(find.text('2'), findsWidgets);

    // Notification banner should be visible for latest unread alert
    expect(find.byKey(const Key('shortage-notification-banner')), findsOneWidget);
    expect(find.textContaining('Amoxicillin 250mg'), findsWidgets);
  });

  testWidgets('Dismiss removes the alert from the state', (tester) async {
    final fakeRepo = FakeShortageRepository([alertOld, alertNewer]);
    final container = ProviderContainer(
      overrides: [
        shortageRepositoryProvider.overrideWithValue(fakeRepo),
        authControllerProvider.overrideWith((ref) => FakeAuthController(
              UserModel(
                id: 'u1',
                email: 'store@medistock.com',
                name: 'Store Officer',
                role: 'STORE_OFFICER',
                facilityId: testFacilityId,
                facilityName: 'National Hospital',
              ),
            )),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: AlertsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Shortage Risk: Amoxicillin 250mg'), findsOneWidget);

    // Remove alert-2 (dismissed)
    container.read(alertsProvider.notifier).removeAlert('alert-2');
    await tester.pumpAndSettle();

    expect(find.text('Shortage Risk: Amoxicillin 250mg'), findsNothing);
    expect(find.text('Shortage Risk: Paracetamol 500mg'), findsOneWidget);
  });

  testWidgets('VerifyShortageScreen dismiss calls POST /api/shortages/{id}/dismiss and shows success', (tester) async {
    final fakeRepo = FakeShortageRepository([alertOld, alertNewer]);
    final container = ProviderContainer(
      overrides: [
        shortageRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path.contains('/dismiss')) {
          return handler.resolve(Response(
            requestOptions: options,
            statusCode: 200,
            data: {'success': true},
          ));
        }
        return handler.next(options);
      },
    ));

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: VerifyShortageScreen(
            shortageAlert: alertNewer.toJson(),
            dio: dio,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Find and tap Dismiss as False Positive button
    final dismissBtn = find.text('Dismiss as False Positive');
    expect(dismissBtn, findsOneWidget);
    await tester.tap(dismissBtn);
    await tester.pumpAndSettle();

    expect(find.text('Shortage alert dismissed as false positive.'), findsOneWidget);
  });

  testWidgets('VerifyShortageScreen displays clear error when dismiss returns 403 Forbidden', (tester) async {
    final fakeRepo = FakeShortageRepository([alertOld, alertNewer]);
    final container = ProviderContainer(
      overrides: [
        shortageRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path.contains('/dismiss')) {
          return handler.reject(DioException(
            requestOptions: options,
            response: Response(
              requestOptions: options,
              statusCode: 403,
              data: {
                'error': {
                  'code': 'FORBIDDEN',
                  'message': 'You can only dismiss alerts for your own assigned facility.',
                }
              },
            ),
          ));
        }
        return handler.next(options);
      },
    ));

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: VerifyShortageScreen(
            shortageAlert: alertNewer.toJson(),
            dio: dio,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final dismissBtn = find.text('Dismiss as False Positive');
    expect(dismissBtn, findsOneWidget);
    await tester.tap(dismissBtn);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('forbidden-error-snackbar')), findsOneWidget);
    expect(find.textContaining('You can only dismiss alerts for your own assigned facility'), findsOneWidget);
  });

  testWidgets('Dismiss as False Positive shows backend error message on 409 conflict', (tester) async {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path.contains('/dismiss')) {
          return handler.reject(DioException(
            requestOptions: options,
            response: Response(
              requestOptions: options,
              statusCode: 409,
              data: {
                'error': {
                  'code': 'CONFLICT',
                  'message': 'Shortage alert is in status RESOLVED and cannot be dismissed. Only OPEN or ACKNOWLEDGED alerts can be dismissed.',
                }
              },
            ),
          ));
        }
        return handler.next(options);
      },
    ));

    await tester.pumpWidget(
      MaterialApp(
        home: VerifyShortageScreen(
          shortageAlert: alertNewer.toJson(),
          dio: dio,
        ),
      ),
    );
    await tester.pumpAndSettle();

    final dismissBtn = find.text('Dismiss as False Positive');
    expect(dismissBtn, findsOneWidget);
    await tester.tap(dismissBtn);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('conflict-error-snackbar')), findsOneWidget);
    expect(find.textContaining('Only OPEN or ACKNOWLEDGED alerts can be dismissed'), findsOneWidget);
  });

  testWidgets('RequestDetailScreen shows Rejected - no source with stock, reason, and purchase request', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final rejectedTransfer = TransferModel(
      id: 'req-rej-1',
      transferNumber: 'TR-2026-REJ',
      sourceFacilityId: '',
      sourceFacilityName: '',
      destinationFacilityId: testFacilityId,
      destinationFacilityName: 'Negombo Base Hospital',
      status: 'REJECTED',
      priority: 'Normal',
      createdAt: DateTime.now(),
      currentLatitude: 0.0,
      currentLongitude: 0.0,
      rejectionReason: 'No facility has surplus stock for this medicine',
      purchaseOrderId: 'c9d8e7f6-1111-2222-3333-444455556666',
      items: [
        TransferItemModel(
          id: 'item-1',
          inventoryItemId: 'med-1',
          itemName: 'Cetirizine 10mg',
          requestedQuantity: 50,
          fulfilledQuantity: 0,
        ),
      ],
    );

    final container = ProviderContainer(
      overrides: [
        transferByIdProvider('req-rej-1').overrideWith((ref) => Future.value(rejectedTransfer)),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: RequestDetailScreen(requestId: 'req-rej-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Rejected - no source with stock'), findsOneWidget);
    expect(find.text('No facility has surplus stock for this medicine'), findsOneWidget);
    expect(find.textContaining('Purchase Request: PO-c9d8e7f6'), findsOneWidget);
  });

  testWidgets('RequestDetailScreen shows Planning failed, retry and Retry button when planning failed', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final failedTransfer = TransferModel(
      id: 'req-fail-1',
      transferNumber: 'TR-2026-FAIL',
      sourceFacilityId: '',
      sourceFacilityName: '',
      destinationFacilityId: testFacilityId,
      destinationFacilityName: 'Negombo Base Hospital',
      status: 'Requested',
      priority: 'Normal',
      createdAt: DateTime.now(),
      currentLatitude: 0.0,
      currentLongitude: 0.0,
      notes: 'Planning failed: ORS routing service timed out',
      items: [
        TransferItemModel(
          id: 'item-2',
          inventoryItemId: 'med-2',
          itemName: 'Paracetamol 500mg',
          requestedQuantity: 100,
          fulfilledQuantity: 0,
        ),
      ],
    );

    final container = ProviderContainer(
      overrides: [
        transferByIdProvider('req-fail-1').overrideWith((ref) => Future.value(failedTransfer)),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: RequestDetailScreen(requestId: 'req-fail-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Planning failed, retry'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });
}

