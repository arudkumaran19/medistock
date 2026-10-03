import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/demand/application/demand_providers.dart';

/// Consumption entry form validation tests.
/// Sathurstiga S. (IT24103156).
///
/// These mirror the backend rules. The backend remains authoritative; this only
/// catches obviously invalid input before the round trip.
void main() {
  group('validateQuantity', () {
    test('accepts a positive quantity', () {
      expect(ConsumptionEntryValidator.validateQuantity('20'), isNull);
    });

    test('accepts a decimal quantity', () {
      expect(ConsumptionEntryValidator.validateQuantity('20.5'), isNull);
    });

    test('rejects an empty value', () {
      expect(ConsumptionEntryValidator.validateQuantity(''), isNotNull);
      expect(ConsumptionEntryValidator.validateQuantity(null), isNotNull);
    });

    test('rejects text', () {
      expect(ConsumptionEntryValidator.validateQuantity('twenty'), 'Enter a valid number.');
    });

    test('rejects zero and negatives', () {
      expect(
        ConsumptionEntryValidator.validateQuantity('0'),
        'Quantity must be greater than zero.',
      );
      expect(
        ConsumptionEntryValidator.validateQuantity('-5'),
        'Quantity must be greater than zero.',
      );
    });
  });

  group('validateMedicineId', () {
    test('accepts a value', () {
      expect(ConsumptionEntryValidator.validateMedicineId('amoxicillin'), isNull);
    });

    test('rejects a blank value', () {
      expect(ConsumptionEntryValidator.validateMedicineId('   '), isNotNull);
    });
  });

  group('validateDate', () {
    test('accepts today', () {
      expect(ConsumptionEntryValidator.validateDate(DateTime.now()), isNull);
    });

    test('accepts a past date', () {
      expect(
        ConsumptionEntryValidator.validateDate(
          DateTime.now().subtract(const Duration(days: 7)),
        ),
        isNull,
      );
    });

    test('rejects a future date', () {
      // Consumption records what has already been used.
      expect(
        ConsumptionEntryValidator.validateDate(
          DateTime.now().add(const Duration(days: 1)),
        ),
        'The date cannot be in the future.',
      );
    });

    test('rejects a missing date', () {
      expect(ConsumptionEntryValidator.validateDate(null), isNotNull);
    });
  });

  group('validateNotes', () {
    test('accepts empty notes', () {
      expect(ConsumptionEntryValidator.validateNotes(null), isNull);
      expect(ConsumptionEntryValidator.validateNotes(''), isNull);
    });

    test('rejects notes beyond the stored column length', () {
      expect(ConsumptionEntryValidator.validateNotes('x' * 513), isNotNull);
    });

    test('accepts notes at the limit', () {
      expect(ConsumptionEntryValidator.validateNotes('x' * 512), isNull);
    });
  });
}
