import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock/features/demand/application/demand_providers.dart';
import 'package:medistock/features/demand/domain/demand_models.dart';
import 'package:medistock/features/demand/presentation/demand_history_screen.dart';
import 'package:medistock/features/demand/presentation/shortage_alerts_screen.dart';

import 'fakes.dart';

/// CRUD tests for the Demand & Shortage field screens.
/// Sathurstiga S. (IT24103156).
///
/// The field app corrects its own consumption entries and acknowledges or resolves
/// alerts. Raising and deleting alerts is a management action and stays in React, per
/// the blueprint's client responsibility split.
void main() {
  Widget wrapAlerts(FakeDemandRepository repository) {
    return ProviderScope(
      overrides: <Override>[demandRepositoryProvider.overrideWithValue(repository)],
      child: const MaterialApp(home: ShortageAlertsScreen()),
    );
  }

  Widget wrapHistory(FakeDemandRepository repository) {
    return ProviderScope(
      overrides: <Override>[demandRepositoryProvider.overrideWithValue(repository)],
      child: const MaterialApp(home: DemandHistoryScreen()),
    );
  }

  group('Shortage alerts', () {
    testWidgets('acknowledges an open alert', (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        shortages: pageOf(<ShortageAlert>[buildAlert(id: 'alert-1')]),
      );

      await tester.pumpWidget(wrapAlerts(repository));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('acknowledge-button')));
      await tester.pumpAndSettle();

      expect(repository.updatedShortageId, 'alert-1');
      expect(repository.updatedShortageStatus, 'ACKNOWLEDGED');
    });

    testWidgets('resolves an alert', (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        shortages: pageOf(<ShortageAlert>[buildAlert(id: 'alert-2')]),
      );

      await tester.pumpWidget(wrapAlerts(repository));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('resolve-button')));
      await tester.pumpAndSettle();

      expect(repository.resolvedShortageId, 'alert-2');
    });

    testWidgets('offers no actions on an already resolved alert',
        (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        shortages: pageOf(<ShortageAlert>[buildAlert(status: 'RESOLVED')]),
      );

      await tester.pumpWidget(wrapAlerts(repository));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('resolve-button')), findsNothing);
      expect(find.byKey(const Key('acknowledge-button')), findsNothing);
    });

    testWidgets('hides acknowledge once an alert is acknowledged',
        (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        shortages: pageOf(<ShortageAlert>[buildAlert(status: 'ACKNOWLEDGED')]),
      );

      await tester.pumpWidget(wrapAlerts(repository));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('acknowledge-button')), findsNothing);
      // Resolving is still available.
      expect(find.byKey(const Key('resolve-button')), findsOneWidget);
    });

    testWidgets('shows the status alongside the risk badge', (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        shortages: pageOf(<ShortageAlert>[buildAlert(status: 'ACKNOWLEDGED')]),
      );

      await tester.pumpWidget(wrapAlerts(repository));
      await tester.pumpAndSettle();

      expect(find.text('ACKNOWLEDGED'), findsOneWidget);
    });
  });

  group('Consumption history', () {
    testWidgets('corrects a quantity', (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        consumption: pageOf(<ConsumptionRecord>[buildRecord(quantityUsed: 200)]),
      );

      await tester.pumpWidget(wrapHistory(repository));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('record-menu-r1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Correct quantity'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('edit-quantity-field')), '20');
      await tester.tap(find.byKey(const Key('edit-save-button')));
      await tester.pumpAndSettle();

      expect(repository.updatedConsumptionId, 'r1');
      expect(repository.lastEntry!.quantityUsed, 20);
    });

    testWidgets('rejects a non-positive correction', (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        consumption: pageOf(<ConsumptionRecord>[buildRecord()]),
      );

      await tester.pumpWidget(wrapHistory(repository));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('record-menu-r1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Correct quantity'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('edit-quantity-field')), '0');
      await tester.tap(find.byKey(const Key('edit-save-button')));
      await tester.pumpAndSettle();

      expect(find.text('Quantity must be greater than zero.'), findsOneWidget);
      expect(repository.updatedConsumptionId, isNull);
    });

    testWidgets('confirms before deleting', (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        consumption: pageOf(<ConsumptionRecord>[buildRecord()]),
      );

      await tester.pumpWidget(wrapHistory(repository));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('record-menu-r1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();

      // The warning names what is lost rather than asking a bare "are you sure?".
      expect(find.textContaining('every later forecast is derived from'), findsOneWidget);

      await tester.tap(find.byKey(const Key('delete-confirm-button')));
      await tester.pumpAndSettle();

      expect(repository.deletedConsumptionId, 'r1');
    });

    testWidgets('cancelling the delete leaves the record alone',
        (WidgetTester tester) async {
      final FakeDemandRepository repository = FakeDemandRepository(
        consumption: pageOf(<ConsumptionRecord>[buildRecord()]),
      );

      await tester.pumpWidget(wrapHistory(repository));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('record-menu-r1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(repository.deletedConsumptionId, isNull);
    });
  });
}
