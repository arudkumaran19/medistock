import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/demand/application/demand_providers.dart';
import 'package:medistock_mobile/features/demand/domain/demand_models.dart';
import 'package:medistock_mobile/features/demand/presentation/shortage_alerts_screen.dart';
import 'package:medistock_mobile/shared/shared.dart';

import 'fakes.dart';

/// Shortage alerts screen widget tests.
/// Sathurstiga S. (IT24103156).
void main() {
  Widget wrap(FakeDemandRepository repository) {
    return ProviderScope(
      overrides: <Override>[
        demandRepositoryProvider.overrideWithValue(repository),
      ],
      child: const MaterialApp(home: ShortageAlertsScreen()),
    );
  }

  testWidgets('shows a loading state before the alerts arrive', (WidgetTester tester) async {
    await tester.pumpWidget(wrap(FakeDemandRepository()));

    expect(find.byType(LoadingView), findsOneWidget);
  });

  testWidgets('renders the derived figures for an alert', (WidgetTester tester) async {
    final FakeDemandRepository repository =
        FakeDemandRepository(shortages: pageOf(<ShortageAlert>[buildAlert()]));

    await tester.pumpWidget(wrap(repository));
    await tester.pumpAndSettle();

    expect(find.text('HIGH'), findsOneWidget);
    // 120 units at 20/day is 6 days of cover against a 10 day lead time.
    expect(find.text('6 days'), findsOneWidget);
    expect(find.text('10 days'), findsOneWidget);
  });

  testWidgets('explains that a manager reviews the response', (WidgetTester tester) async {
    final FakeDemandRepository repository =
        FakeDemandRepository(shortages: pageOf(<ShortageAlert>[buildAlert()]));

    await tester.pumpWidget(wrap(repository));
    await tester.pumpAndSettle();

    // Flutter notifies; approving is a management action in React.
    expect(find.byKey(const Key('requires-transfer-note')), findsOneWidget);
  });

  testWidgets('shows no projected stockout rather than zero days', (WidgetTester tester) async {
    final FakeDemandRepository repository = FakeDemandRepository(
      shortages: pageOf(<ShortageAlert>[
        buildAlert(
          daysRemaining: null,
          riskLevel: 'MEDIUM',
          requiresTransfer: false,
          averageDailyConsumption: 0,
        ),
      ]),
    );

    await tester.pumpWidget(wrap(repository));
    await tester.pumpAndSettle();

    expect(find.text('No stockout projected'), findsOneWidget);
    expect(find.byKey(const Key('requires-transfer-note')), findsNothing);
  });

  testWidgets('shows an empty state when there are no alerts', (WidgetTester tester) async {
    final FakeDemandRepository repository =
        FakeDemandRepository(shortages: emptyPage<ShortageAlert>());

    await tester.pumpWidget(wrap(repository));
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
  });

  testWidgets('shows the backend message when the request fails', (WidgetTester tester) async {
    final FakeDemandRepository repository = FakeDemandRepository(
      shortageError: const ApiFailure(
        code: 'NETWORK_UNAVAILABLE',
        message: 'The server could not be reached.',
      ),
    );

    await tester.pumpWidget(wrap(repository));
    await tester.pumpAndSettle();

    expect(find.byType(ErrorView), findsOneWidget);
    expect(find.textContaining('could not be reached'), findsOneWidget);
  });

  testWidgets('passes the selected risk level to the repository', (WidgetTester tester) async {
    final FakeDemandRepository repository =
        FakeDemandRepository(shortages: pageOf(<ShortageAlert>[buildAlert()]));

    await tester.pumpWidget(wrap(repository));
    await tester.pumpAndSettle();

    await tester.tap(find.text('High'));
    await tester.pumpAndSettle();

    expect(repository.lastRiskFilter, 'HIGH');
  });
}
