import 'dart:io' show Platform;
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:medistock_mobile/core/network/api_client.dart';
import 'package:medistock_mobile/features/auth/domain/auth_state.dart';
import 'package:medistock_mobile/features/auth/presentation/auth_controller.dart';
import 'package:medistock_mobile/features/facility_user/requests/new_request_wizard.dart';
import 'package:medistock_mobile/shared/models/user_model.dart';

class FakeAuthController extends StateNotifier<AuthState>
    implements AuthController {
  FakeAuthController(UserModel? user)
      : super(AuthState(
          status: user != null
              ? AuthStatus.authenticated
              : AuthStatus.unauthenticated,
          user: user,
          selectedRole: user?.role,
        ));

  @override
  Future<void> checkAuthStatus() async {}

  @override
  void selectRole(String role) {}

  @override
  Future<bool> login({required String email, required String password}) async =>
      true;

  @override
  Future<void> logout() async {}
}

void main() {
  testWidgets(
      'NewRequestWizard renders step 1 with prefilled data and advances to step 2',
      skip: Platform.environment['CI'] == 'true', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/api/medicines')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              {
                'id': '33333333-3333-3333-3333-333333333333',
                'name': 'Amoxicillin 250 mg',
                'code': 'AMOX-250',
                'unit': 'capsule',
              },
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('{"success": true}', 200,
          headers: {'content-type': 'application/json'});
    });

    final testUser = UserModel(
      id: 'u1',
      email: 'officer@medistock.com',
      name: 'Store Officer',
      role: 'FACILITYUSER',
      facilityId: '11111111-1111-1111-1111-111111111111',
      facilityName: 'Teaching Hospital Kandy',
    );

    final testApiClient =
        ApiClient(httpClient: mockClient, authToken: 'test-token');

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider
              .overrideWith((ref) => FakeAuthController(testUser)),
        ],
        child: MaterialApp(
          home: NewRequestWizard(
            prefillMedicineId: '33333333-3333-3333-3333-333333333333',
            prefillMedicineName: 'Amoxicillin 250 mg',
            prefillQuantity: 100,
            prefillUrgency: 'Urgent',
            prefillNotes: 'Test shortage requisition',
            apiClient: testApiClient,
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify Step 1 headers and title
    expect(find.text('Select Required Medicine'), findsOneWidget);
    expect(find.text('Medicine & Quantity'), findsOneWidget);
    expect(find.text('Review & Submit'), findsOneWidget);

    // Verify prefilled quantity
    expect(find.text('100'), findsOneWidget);

    // Verify continue button is present and tap it
    final continueButton = find.text('Continue to Review');
    expect(continueButton, findsOneWidget);
    await tester.ensureVisible(continueButton);
    await tester.pumpAndSettle();
    await tester.tap(continueButton);
    await tester.pumpAndSettle();

    // Verify Step 2 is now displayed
    expect(find.text('Review & Confirm Requisition'), findsOneWidget);
    expect(find.text('Automated Source Facility Matching'), findsOneWidget);
    expect(find.text('Submit Transfer Request'), findsOneWidget);
  });
}
