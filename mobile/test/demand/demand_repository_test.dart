import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medistock/core/network/api_client.dart';
import 'package:medistock/features/demand/data/demand_repository.dart';
import 'package:medistock/features/demand/domain/demand_models.dart';
import 'package:medistock/shared/models/paged_response.dart';

/// Repository tests: the frozen contract paths, the envelope, and error mapping.
/// Sathurstiga S. (IT24103156).
void main() {
  late _RecordingAdapter adapter;
  late DemandRepository repository;

  setUp(() {
    adapter = _RecordingAdapter();

    final Dio dio = Dio(BaseOptions(baseUrl: 'http://backend.test'));
    dio.httpClientAdapter = adapter;

    repository = DemandRepository(ApiClient(dio: dio));
  });

  test('gets shortages from the contract path and unwraps the envelope', () async {
    adapter.respondWith(<String, dynamic>{
      'success': true,
      'data': <String, dynamic>{
        'items': <dynamic>[_alertJson()],
        'page': 1,
        'pageSize': 20,
        'totalCount': 1,
        'totalPages': 1,
        'hasNextPage': false,
        'hasPreviousPage': false,
      },
    });

    final PagedResponse<ShortageAlert> page =
        await repository.getShortages(facilityId: 'f1', riskLevel: 'HIGH');

    expect(adapter.lastPath, '/api/shortages');
    expect(adapter.lastQuery?['riskLevel'], 'HIGH');
    expect(page.items.single.daysRemaining, 6);
  });

  test('omits an empty risk filter from the query string', () async {
    adapter.respondWith(<String, dynamic>{
      'success': true,
      'data': <String, dynamic>{'items': <dynamic>[]},
    });

    await repository.getShortages(facilityId: 'f1', riskLevel: '');

    expect(adapter.lastQuery?.containsKey('riskLevel'), isFalse);
  });

  test('posts a consumption entry to the contract path', () async {
    adapter.respondWith(<String, dynamic>{
      'success': true,
      'data': <String, dynamic>{
        'id': 'created-1',
        'facilityId': 'f1',
        'medicineId': 'm1',
        'quantityUsed': 20,
        'consumptionDate': '2026-09-20T00:00:00Z',
        'source': 'FLUTTER_CONSUMPTION_ENTRY',
        'notes': null,
      },
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

    expect(adapter.lastPath, '/api/consumption');
    expect(adapter.lastMethod, 'POST');
    expect(record.id, 'created-1');
  });

  test('gets forecasts from the contract path', () async {
    adapter.respondWith(<String, dynamic>{
      'success': true,
      'data': <String, dynamic>{'items': <dynamic>[]},
    });

    await repository.getForecasts(facilityId: 'f1');

    expect(adapter.lastPath, '/api/demand/forecasts');
  });

  test('gets one shortage alert by id', () async {
    adapter.respondWith(<String, dynamic>{'success': true, 'data': _alertJson()});

    await repository.getShortageById('alert-42');

    expect(adapter.lastPath, '/api/shortages/alert-42');
  });

  test('maps the agreed error contract onto ApiFailure', () async {
    adapter.respondWith(
      <String, dynamic>{
        'success': false,
        'error': <String, dynamic>{
          'code': 'DEMAND_VALIDATION_ERROR',
          'message': 'quantityUsed must be greater than zero.',
          'traceId': 'trace-1',
        },
      },
      statusCode: 400,
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
            .having((ApiFailure f) => f.code, 'code', 'DEMAND_VALIDATION_ERROR')
            .having((ApiFailure f) => f.traceId, 'traceId', 'trace-1'),
      ),
    );
  });

  test('maps a connection failure onto a readable message', () async {
    adapter.failWith(DioExceptionType.connectionError);

    await expectLater(
      repository.getShortages(facilityId: 'f1'),
      throwsA(
        isA<ApiFailure>().having((ApiFailure f) => f.code, 'code', 'NETWORK_UNAVAILABLE'),
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

/// Captures the outgoing request and returns a canned response.
class _RecordingAdapter implements HttpClientAdapter {
  Map<String, dynamic>? _body;
  int _statusCode = 200;
  DioExceptionType? _failureType;

  String? lastPath;
  String? lastMethod;
  Map<String, dynamic>? lastQuery;

  void respondWith(Map<String, dynamic> body, {int statusCode = 200}) {
    _body = body;
    _statusCode = statusCode;
    _failureType = null;
  }

  void failWith(DioExceptionType type) {
    _failureType = type;
  }

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastPath = options.path;
    lastMethod = options.method;
    lastQuery = Map<String, dynamic>.from(options.queryParameters);

    if (_failureType != null) {
      throw DioException(requestOptions: options, type: _failureType!);
    }

    return ResponseBody.fromString(
      jsonEncode(_body ?? <String, dynamic>{}),
      _statusCode,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }
}
