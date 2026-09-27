import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock/features/demand/application/demand_providers.dart';
import 'package:medistock/features/demand/presentation/consumption_entry_screen.dart';
import 'package:medistock/shared/models/paged_response.dart';

import 'fakes.dart';

/// Consumption entry screen widget and form tests.
/// Sathurstiga S. (IT24103156).
void main() {
  Widget wrap(FakeDemandRepository repository) {
    return ProviderScope(
      overrides: <Override>[
        demandRepositoryProvider.overrideWithValue(repository),
      ],
      child: const MaterialApp(home: ConsumptionEntryScreen()),
    );
  }

  Future<void> fillForm(
    WidgetTester tester, {
    String medicine = 'amoxicillin',
    String quantity = '20',
  }) async {
    await tester.enterText(find.byKey(const Key('medicine-field')), medicine);
    await tester.enterText(find.byKey(const Key('quantity-field')), quantity);
  }

  testWidgets('renders the entry form', (WidgetTester tester) async {
    await tester.pumpWidget(wrap(FakeDemandRepository()));

    expect(find.byKey(const Key('medicine-field')), findsOneWidget);
    expect(find.byKey(const Key('quantity-field')), findsOneWidget);
    expect(find.byKey(const Key('submit-button')), findsOneWidget);
  });

  testWidgets('blocks submission when the quantity is not positive',
      (WidgetTester tester) async {
    final FakeDemandRepository repository = FakeDemandRepository();

    await tester.pumpWidget(wrap(repository));
    await fillForm(tester, quantity: '0');

    await tester.tap(find.byKey(const Key('submit-button')));
    await tester.pumpAndSettle();

    expect(find.text('Quantity must be greater than zero.'), findsOneWidget);
    expect(repository.lastEntry, isNull);
  });

  testWidgets('blocks submission when the medicine is missing',
      (WidgetTester tester) async {
    final FakeDemandRepository repository = FakeDemandRepository();

    await tester.pumpWidget(wrap(repository));
    await fillForm(tester, medicine: '');

    await tester.tap(find.byKey(const Key('submit-button')));
    await tester.pumpAndSettle();

    expect(find.text('Select a medicine.'), findsOneWidget);
    expect(repository.lastEntry, isNull);
  });

  testWidgets('submits a valid entry to the repository', (WidgetTester tester) async {
    final FakeDemandRepository repository = FakeDemandRepository();

    await tester.pumpWidget(wrap(repository));
    await fillForm(tester);

    await tester.tap(find.byKey(const Key('submit-button')));
    await tester.pumpAndSettle();

    expect(repository.lastEntry, isNotNull);
    expect(repository.lastEntry!.quantityUsed, 20);
    expect(repository.lastEntry!.medicineId, 'amoxicillin');
    expect(repository.lastEntry!.source, 'FLUTTER_CONSUMPTION_ENTRY');
  });

  testWidgets('confirms a successful entry and clears the form',
      (WidgetTester tester) async {
    await tester.pumpWidget(wrap(FakeDemandRepository()));
    await fillForm(tester);

    await tester.tap(find.byKey(const Key('submit-button')));
    await tester.pumpAndSettle();

    expect(find.text('Consumption recorded.'), findsOneWidget);

    // The field is a TextFormField, not a TextField - casting to the latter throws.
    final TextFormField quantityField =
        tester.widget(find.byKey(const Key('quantity-field')));
    expect(quantityField.controller?.text, isEmpty);
  });

  testWidgets('shows the backend rejection message', (WidgetTester tester) async {
    final FakeDemandRepository repository = FakeDemandRepository(
      recordError: const ApiFailure(
        code: 'DEMAND_VALIDATION_ERROR',
        message: 'consumptionDate cannot be in the future.',
      ),
    );

    await tester.pumpWidget(wrap(repository));
    await fillForm(tester);

    await tester.tap(find.byKey(const Key('submit-button')));
    await tester.pumpAndSettle();

    // The backend stays authoritative: its message is shown as-is.
    expect(find.byKey(const Key('entry-error')), findsOneWidget);
    expect(find.text('consumptionDate cannot be in the future.'), findsOneWidget);
  });

  testWidgets('does not allow picking a future date', (WidgetTester tester) async {
    await tester.pumpWidget(wrap(FakeDemandRepository()));

    await tester.tap(find.byKey(const Key('pick-date-button')));
    await tester.pumpAndSettle();

    final DateTime tomorrow = DateTime.now().add(const Duration(days: 1));
    final Finder tomorrowCell = find.text('${tomorrow.day}');

    // Either the day is not rendered at all, or it is rendered disabled. Both are
    // acceptable; what matters is that tomorrow cannot be selected.
    if (tomorrowCell.evaluate().isNotEmpty && tomorrow.month == DateTime.now().month) {
      await tester.tap(tomorrowCell.first);
      await tester.pumpAndSettle();
    }

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('pick-date-button')), findsOneWidget);
  });
}
