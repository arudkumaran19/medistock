import '../../../core/network/api_client.dart';
import '../../../shared/models/paged_response.dart';
import '../domain/demand_models.dart';

/// Demand & Shortage API access for the operational application.
/// Sathurstiga S. (IT24103156).
///
/// Follows the frozen Demand contract. Flutter never calls the agent service.
///
/// Integration note
/// ----------------
/// This vertical originally shipped its own Dio-based `ApiClient` placeholder. The
/// shared `core/network/ApiClient` on develop is `http`-based and exposes a single
/// `request(...)` that already unwraps the `data` envelope and throws on a non-2xx
/// response. The shared client is authoritative, so this repository was adapted to
/// it rather than the other way round. Failures are translated back into
/// [ApiFailure] so the demand providers and screens are unchanged.
/// Transport seam owned by this vertical.
///
/// The shared `ApiClient` calls the package-level `http` functions directly, so it
/// cannot be faked in a unit test. This one-method abstraction keeps the repository
/// testable without altering the shared client.
abstract class DemandTransport {
  Future<dynamic> send(
    String path, {
    String method,
    Map<String, dynamic>? body,
  });
}

/// Default transport: delegates straight to the shared core client.
class ApiClientTransport implements DemandTransport {
  const ApiClientTransport(this._client);

  final ApiClient _client;

  @override
  Future<dynamic> send(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) {
    return _client.request(path, method: method, body: body);
  }
}

class DemandRepository {
  DemandRepository(this._transport);

  /// Convenience for production wiring: build straight from the shared client.
  factory DemandRepository.fromApiClient(ApiClient client) =>
      DemandRepository(ApiClientTransport(client));

  final DemandTransport _transport;

  // ---------------------------------------------------------------------------
  // Transport helpers
  // ---------------------------------------------------------------------------

  /// Builds `?a=1&b=2`, skipping null and empty values.
  static String _query(Map<String, dynamic> parameters) {
    final List<String> pairs = <String>[];

    parameters.forEach((String key, dynamic value) {
      if (value == null) {
        return;
      }

      final String text = value.toString();

      if (text.isEmpty) {
        return;
      }

      pairs.add(
        '${Uri.encodeQueryComponent(key)}=${Uri.encodeQueryComponent(text)}',
      );
    });

    return pairs.isEmpty ? '' : '?${pairs.join('&')}';
  }

  /// The shared client throws a bare [Exception] carrying the backend's message.
  /// The demand UI catches [ApiFailure], so translate once, here.
  static ApiFailure _toFailure(Object error) {
    if (error is ApiFailure) {
      return error;
    }

    final String message =
        error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');

    // The shared client loses the status code, but it only produces an empty message
    // when the response had no body - which the backend sends for 401 and 403. Saying
    // so is more use than "could not be completed": the usual cause is a role that
    // may not perform the action, e.g. a facility manager trying to record usage.
    return ApiFailure(
      code: 'DEMAND_REQUEST_FAILED',
      message: message.isEmpty
          ? 'Your account is not allowed to do this. Sign in with a role that can.'
          : message,
    );
  }

  Future<Map<String, dynamic>> _send(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    try {
      final dynamic data = await _transport.send(
        path,
        method: method,
        body: body,
      );

      if (data is Map<String, dynamic>) {
        return data;
      }

      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }

      return <String, dynamic>{};
    } catch (error) {
      throw _toFailure(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Consumption
  // ---------------------------------------------------------------------------

  /// GET /api/consumption
  Future<PagedResponse<ConsumptionRecord>> getConsumption({
    required String facilityId,
    String? medicineId,
    String? search,
    int page = 1,
    int pageSize = 20,
    String sortBy = 'consumptionDate',
    String sortOrder = 'desc',
  }) async {
    final String path = '/api/consumption${_query(<String, dynamic>{
          'facilityId': facilityId,
          'medicineId': medicineId,
          'search': search,
          'page': page,
          'pageSize': pageSize,
          'sortBy': sortBy,
          'sortOrder': sortOrder,
        })}';

    return PagedResponse<ConsumptionRecord>.fromJson(
      await _send(path),
      ConsumptionRecord.fromJson,
    );
  }

  /// POST /api/consumption
  Future<ConsumptionRecord> recordConsumption(ConsumptionEntry entry) async {
    return ConsumptionRecord.fromJson(
      await _send('/api/consumption', method: 'POST', body: entry.toJson()),
    );
  }

  /// PUT /api/consumption/{id}
  ///
  /// Corrects an entry made in the field. Consumption is what every forecast is built
  /// from, so a mis-keyed quantity skews demand until it is fixed.
  ///
  /// Not in the frozen API contract (blueprint section 36). Confirm with the API
  /// conventions owner before integration.
  Future<ConsumptionRecord> updateConsumption(
    String id,
    ConsumptionEntry entry,
  ) async {
    return ConsumptionRecord.fromJson(
      await _send('/api/consumption/$id', method: 'PUT', body: entry.toJson()),
    );
  }

  /// DELETE /api/consumption/{id}
  Future<void> deleteConsumption(String id) async {
    await _send('/api/consumption/$id', method: 'DELETE');
  }

  // ---------------------------------------------------------------------------
  // Shortages
  // ---------------------------------------------------------------------------

  /// POST /api/shortages/{id}/resolve
  ///
  /// Resolving is a status change, not a delete: the alert stays on record so the
  /// shortage history remains auditable.
  Future<ShortageAlert> resolveShortage(String id) async {
    return ShortageAlert.fromJson(
      await _send('/api/shortages/$id/resolve', method: 'POST'),
    );
  }

  /// PUT /api/shortages/{id} - status only, from the field app.
  ///
  /// A store officer can acknowledge an alert they have seen. Correcting the stock
  /// figure is a management action and stays in the React console.
  Future<ShortageAlert> updateShortageStatus(String id, String status) async {
    return ShortageAlert.fromJson(
      await _send(
        '/api/shortages/$id',
        method: 'PUT',
        body: <String, dynamic>{'status': status},
      ),
    );
  }

  /// GET /api/shortages
  Future<PagedResponse<ShortageAlert>> getShortages({
    required String facilityId,
    String? riskLevel,
    int page = 1,
    int pageSize = 20,
  }) async {
    final String path = '/api/shortages${_query(<String, dynamic>{
          'facilityId': facilityId,
          'riskLevel': riskLevel,
          'page': page,
          'pageSize': pageSize,
          'sortBy': 'generatedAt',
          'sortOrder': 'desc',
        })}';

    return PagedResponse<ShortageAlert>.fromJson(
      await _send(path),
      ShortageAlert.fromJson,
    );
  }

  /// GET /api/shortages/{id}
  Future<ShortageAlert> getShortageById(String id) async {
    return ShortageAlert.fromJson(await _send('/api/shortages/$id'));
  }

  // ---------------------------------------------------------------------------
  // Forecasts
  // ---------------------------------------------------------------------------

  /// GET /api/demand/forecasts
  Future<PagedResponse<DemandForecast>> getForecasts({
    required String facilityId,
    String? medicineId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final String path = '/api/demand/forecasts${_query(<String, dynamic>{
          'facilityId': facilityId,
          'medicineId': medicineId,
          'page': page,
          'pageSize': pageSize,
          'sortBy': 'generatedAt',
          'sortOrder': 'desc',
        })}';

    return PagedResponse<DemandForecast>.fromJson(
      await _send(path),
      DemandForecast.fromJson,
    );
  }
}
