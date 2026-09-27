import 'package:flutter_test/flutter_test.dart';
import 'package:medistock/features/demand/domain/demand_models.dart';
import 'package:medistock/shared/models/paged_response.dart';

/// Domain model tests for the Demand & Shortage vertical.
/// Sathurstiga S. (IT24103156).
void main() {
  group('ShortageAlert', () {
    test('parses the blueprint worked example', () {
      final ShortageAlert alert = ShortageAlert.fromJson(<String, dynamic>{
        'id': 'a1',
        'facilityId': 'f1',
        'medicineId': 'm1',
        'demandForecastId': 'fc1',
        'currentStock': 120,
        'averageDailyConsumption': 20,
        'daysRemaining': 6,
        'projectedStockoutDate': '2026-09-27T00:00:00Z',
        'leadTimeDays': 10,
        'riskLevel': 'HIGH',
        'requiresTransfer': true,
        'generatedAt': '2026-09-21T08:00:00Z',
        'status': 'OPEN',
      });

      expect(alert.daysRemaining, 6);
      expect(alert.requiresTransfer, isTrue);
      expect(alert.coverLabel, '6 days');
    });

    test('treats a null daysRemaining as no projected stockout, not zero days', () {
      final ShortageAlert alert = ShortageAlert.fromJson(<String, dynamic>{
        'id': 'a1',
        'facilityId': 'f1',
        'medicineId': 'm1',
        'demandForecastId': null,
        'currentStock': 500,
        'averageDailyConsumption': 0,
        'daysRemaining': null,
        'projectedStockoutDate': null,
        'leadTimeDays': 10,
        'riskLevel': 'MEDIUM',
        'requiresTransfer': false,
        'generatedAt': '2026-09-21T08:00:00Z',
        'status': 'OPEN',
      });

      expect(alert.daysRemaining, isNull);
      expect(alert.projectedStockoutDate, isNull);
      expect(alert.coverLabel, 'No stockout projected');
    });

    test('uses the singular for a single day of cover', () {
      final ShortageAlert alert = _alertWithDays(1);

      expect(alert.coverLabel, '1 day');
    });

    test('renders zero days as an imminent stockout', () {
      final ShortageAlert alert = _alertWithDays(0);

      expect(alert.coverLabel, '0 days');
    });
  });

  group('DemandForecast', () {
    test('parses a forecast and labels the method for display', () {
      final DemandForecast forecast = DemandForecast.fromJson(<String, dynamic>{
        'id': 'fc1',
        'facilityId': 'f1',
        'medicineId': 'm1',
        'forecastDate': '2026-10-21T00:00:00Z',
        'predictedDemand': 600,
        'averageDailyConsumption': 20,
        'method': 'WEIGHTED_MOVING_AVERAGE',
        'windowDays': 30,
        'horizonDays': 30,
        'confidenceScore': 1,
        'leadTimeDays': 10,
        'generatedAt': '2026-09-21T08:00:00Z',
        'status': 'ACTIVE',
      });

      expect(forecast.averageDailyConsumption, 20);
      expect(forecast.predictedDemand, 600);
      expect(forecast.methodLabel, 'weighted moving average');
    });
  });

  group('ConsumptionEntry', () {
    test('serialises the date as ISO 8601 UTC', () {
      final ConsumptionEntry entry = ConsumptionEntry(
        facilityId: 'f1',
        medicineId: 'm1',
        quantityUsed: 20,
        consumptionDate: DateTime.utc(2026, 9, 20),
        source: 'FLUTTER_CONSUMPTION_ENTRY',
      );

      final Map<String, dynamic> json = entry.toJson();

      expect(json['consumptionDate'], startsWith('2026-09-20T'));
      expect(json['quantityUsed'], 20);
    });

    test('omits empty notes rather than sending a blank string', () {
      final ConsumptionEntry entry = ConsumptionEntry(
        facilityId: 'f1',
        medicineId: 'm1',
        quantityUsed: 20,
        consumptionDate: DateTime.utc(2026, 9, 20),
        source: 'FLUTTER_CONSUMPTION_ENTRY',
        notes: '',
      );

      expect(entry.toJson().containsKey('notes'), isFalse);
    });
  });

  group('PagedResponse', () {
    test('parses the frozen pagination envelope', () {
      final PagedResponse<ConsumptionRecord> page =
          PagedResponse<ConsumptionRecord>.fromJson(
        <String, dynamic>{
          'items': <dynamic>[
            <String, dynamic>{
              'id': 'r1',
              'facilityId': 'f1',
              'medicineId': 'm1',
              'quantityUsed': 20,
              'consumptionDate': '2026-09-20T00:00:00Z',
              'source': 'SEED',
              'notes': null,
            },
          ],
          'page': 2,
          'pageSize': 10,
          'totalCount': 25,
          'totalPages': 3,
          'hasNextPage': true,
          'hasPreviousPage': true,
        },
        ConsumptionRecord.fromJson,
      );

      expect(page.items, hasLength(1));
      expect(page.page, 2);
      expect(page.totalPages, 3);
      expect(page.hasNextPage, isTrue);
      expect(page.isEmpty, isFalse);
    });

    test('treats a missing items array as an empty page', () {
      final PagedResponse<ConsumptionRecord> page =
          PagedResponse<ConsumptionRecord>.fromJson(
        <String, dynamic>{},
        ConsumptionRecord.fromJson,
      );

      expect(page.isEmpty, isTrue);
    });
  });

  group('ApiFailure', () {
    test('parses the agreed error contract', () {
      final ApiFailure failure = ApiFailure.fromJson(<String, dynamic>{
        'success': false,
        'error': <String, dynamic>{
          'code': 'DEMAND_VALIDATION_ERROR',
          'message': 'quantityUsed must be greater than zero.',
          'traceId': 'trace-1',
        },
      });

      expect(failure.code, 'DEMAND_VALIDATION_ERROR');
      expect(failure.message, 'quantityUsed must be greater than zero.');
      expect(failure.traceId, 'trace-1');
    });
  });
}

ShortageAlert _alertWithDays(int days) {
  return ShortageAlert.fromJson(<String, dynamic>{
    'id': 'a1',
    'facilityId': 'f1',
    'medicineId': 'm1',
    'demandForecastId': null,
    'currentStock': 20,
    'averageDailyConsumption': 20,
    'daysRemaining': days,
    'projectedStockoutDate': '2026-09-22T00:00:00Z',
    'leadTimeDays': 10,
    'riskLevel': 'HIGH',
    'requiresTransfer': true,
    'generatedAt': '2026-09-21T08:00:00Z',
    'status': 'OPEN',
  });
}
