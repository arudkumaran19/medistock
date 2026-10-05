import 'package:flutter_test/flutter_test.dart';
import 'package:medistock_mobile/features/demand/data/demand_repository.dart';
import 'package:medistock_mobile/features/demand/domain/demand_models.dart';
import 'package:medistock_mobile/shared/models/paged_response.dart';

/// Repository tests: the frozen contract paths, query building and error mapping.
/// Sathurstiga S. (IT24103156).
///
/// The shared core ApiClient calls the package-level `http` functions directly, so it
/// cannot be faked. The repository therefore depends on [DemandTransport], and these
/// tests drive that seam. Envelope unwrapping is the shared client's job now, so the
/// fake returns payloads already unwrapped from `data`.
void main() {
  late _FakeTransport transport;
  late DemandRepository repository;

  setUp(() {
    transport = _FakeTransport();
    repository = DemandRepository(transport);
  });

  test('gets shortages from the contract path and maps the payload', () async {
    transport.respondWith(<String, dynamic>{
      'items': <dynamic>[_alertJson()],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    });

    final PagedResponse<ShortageAlert> page =
        await repository.getShortages(facilityId: 'f1', riskLevel: 'HIGH');

    expect(transport.lastPath, startsWith('/api/shortages?'));
    expect(transport.lastPath, contains('riskLevel=HIGH'));
    expect(transport.lastPath, contains('facilityId=f1'));
    expect(page.items.single.daysRemaining, 6);
  });

  test('omits an empty risk filter from the query string', () async {
    transport.respondWith(<String, dynamic>{'items': <dynamic>[]});

    await repository.getShortages(facilityId: 'f1', riskLevel: '');

    expect(transport.lastPath, isNot(contains('riskLevel')));
  });

  test('posts a consumption entry to the contract path', () async {
    transport.respondWith(<String, dynamic>{
      'id': 'created-1',
      'facilityId': 'f1',
      'medicineId': 'm1',
      'quantityUsed': 20,
      'consumptionDate': '2026-09-20T00:00:00Z',
      'source': 'FLUTTER_CONSUMPTION_ENTRY',
      'notes': null,
    });

    final ConsumptionRecord record = await repository.recordConsumption(
      ConsumptionEntry(
        facilityId: 'f1',
        medicineId: 'm1',
        quantityUsed: 20,
        consumptionDate: DateTime.utc(2026, 9, 20),
        source: 'FLUTTER_CONSUMPTION_ENTRY',
      ),
    );

    expect(transport.lastPath, '/api/consumption');
    expect(transport.lastMethod, 'POST');
    expect(transport.lastBody?['medicineId'], 'm1');
    expect(record.id, 'created-1');
  });

  test('gets forecasts from the contract path', () async {
    transport.respondWith(<String, dynamic>{'items': <dynamic>[]});

    await repository.getForecasts(facilityId: 'f1');

    expect(transport.lastPath, startsWith('/api/demand/forecasts?'));
  });

  test('gets one shortage alert by id', () async {
    transport.respondWith(_alertJson());

    await repository.getShortageById('alert-42');

    expect(transport.lastPath, '/api/shortages/alert-42');
  });

  test('deletes a consumption record at the contract path', () async {
    transport.respondWith(<String, dynamic>{});

    await repository.deleteConsumption('c-9');

    expect(transport.lastPath, '/api/consumption/c-9');
    expect(transport.lastMethod, 'DELETE');
  });

  test('translates a backend rejection into ApiFailure', () async {
    // The shared client raises a bare Exception carrying the backend's message; the
    // structured code and traceId of the error contract do not survive it. The
    // repository still guarantees the demand UI only ever sees an ApiFailure.
    transport.failWith(
      Exception('quantityUsed must be greater than zero.'),
    );

    await expectLater(
      repository.recordConsumption(
        ConsumptionEntry(
          facilityId: 'f1',
          medicineId: 'm1',
          quantityUsed: -1,
          consumptionDate: DateTime.utc(2026, 9, 20),
          source: 'FLUTTER_CONSUMPTION_ENTRY',
        ),
      ),
      throwsA(
        isA<ApiFailure>()
            .having((ApiFailure f) => f.code, 'code', 'DEMAND_REQUEST_FAILED')
            .having(
              (ApiFailure f) => f.message,
              'message',
              'quantityUsed must be greater than zero.',
            ),
      ),
    );
  });

  test('translates a connection failure into a readable ApiFailure', () async {
    transport.failWith(Exception('Connection refused'));

    await expectLater(
      repository.getShortages(facilityId: 'f1'),
      throwsA(
        isA<ApiFailure>().having(
          (ApiFailure f) => f.message,
          'message',
          contains('Connection refused'),
        ),
      ),
    );
  });

  test('an ApiFailure raised underneath is passed through unchanged', () async {
    transport.failWith(
      const ApiFailure(code: 'ALREADY_MAPPED', message: 'kept as is'),
    );

    await expectLater(
      repository.getShortageById('a1'),
      throwsA(
        isA<ApiFailure>().having((ApiFailure f) => f.code, 'code', 'ALREADY_MAPPED'),
      ),
    );
  });
}

Map<String, dynamic> _alertJson() => <String, dynamic>{
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
    };

/// Captures the outgoing request and returns a canned payload.
class _FakeTransport implements DemandTransport {
  dynamic _payload;
  Object? _failure;

  String? lastPath;
  String? lastMethod;
  Map<String, dynamic>? lastBody;

  void respondWith(dynamic payload) {
    _payload = payload;
    _failure = null;
  }

  void failWith(Object error) {
    _failure = error;
  }

  @override
  Future<dynamic> send(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    lastPath = path;
    lastMethod = method;
    lastBody = body;

    if (_failure != null) {
      throw _failure!;
    }

    return _payload ?? <String, dynamic>{};
  }
}
