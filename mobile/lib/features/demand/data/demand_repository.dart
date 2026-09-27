import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/models/paged_response.dart';
import '../domain/demand_models.dart';

/// Demand & Shortage API access for the operational application.
/// Sathurstiga S. (IT24103156).
///
/// Follows the frozen Demand contract. Flutter never calls the agent service.
class DemandRepository {
  DemandRepository(this._client);

  final ApiClient _client;

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
    try {
      final Response<dynamic> response = await _client.dio.get<dynamic>(
        '/api/consumption',
        queryParameters: <String, dynamic>{
          'facilityId': facilityId,
          if (medicineId != null) 'medicineId': medicineId,
          if (search != null && search.isNotEmpty) 'search': search,
          'page': page,
          'pageSize': pageSize,
          'sortBy': sortBy,
          'sortOrder': sortOrder,
        },
      );

      return PagedResponse<ConsumptionRecord>.fromJson(
        ApiClient.unwrap(response),
        ConsumptionRecord.fromJson,
      );
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }

  /// POST /api/consumption
  Future<ConsumptionRecord> recordConsumption(ConsumptionEntry entry) async {
    try {
      final Response<dynamic> response = await _client.dio.post<dynamic>(
        '/api/consumption',
        data: entry.toJson(),
      );

      return ConsumptionRecord.fromJson(ApiClient.unwrap(response));
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }

  /// PUT /api/consumption/{id}
  ///
  /// Corrects an entry made in the field. Consumption is what every forecast is built
  /// from, so a mis-keyed quantity skews demand until it is fixed.
  ///
  /// Not in the frozen API contract (blueprint section 36). Confirm with the API
  /// conventions owner before integration.
  Future<ConsumptionRecord> updateConsumption(String id, ConsumptionEntry entry) async {
    try {
      final Response<dynamic> response = await _client.dio.put<dynamic>(
        '/api/consumption/$id',
        data: entry.toJson(),
      );

      return ConsumptionRecord.fromJson(ApiClient.unwrap(response));
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }

  /// DELETE /api/consumption/{id}
  Future<void> deleteConsumption(String id) async {
    try {
      await _client.dio.delete<dynamic>('/api/consumption/$id');
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }

  /// POST /api/shortages/{id}/resolve
  ///
  /// Resolving is a status change, not a delete: the alert stays on record so the
  /// shortage history remains auditable.
  Future<ShortageAlert> resolveShortage(String id) async {
    try {
      final Response<dynamic> response =
          await _client.dio.post<dynamic>('/api/shortages/$id/resolve');

      return ShortageAlert.fromJson(ApiClient.unwrap(response));
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }

  /// PUT /api/shortages/{id} - status only, from the field app.
  ///
  /// A store officer can acknowledge an alert they have seen. Correcting the stock
  /// figure is a management action and stays in the React console.
  Future<ShortageAlert> updateShortageStatus(String id, String status) async {
    try {
      final Response<dynamic> response = await _client.dio.put<dynamic>(
        '/api/shortages/$id',
        data: <String, dynamic>{'status': status},
      );

      return ShortageAlert.fromJson(ApiClient.unwrap(response));
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }

  /// GET /api/demand/forecasts
  Future<PagedResponse<DemandForecast>> getForecasts({
    required String facilityId,
    String? medicineId,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final Response<dynamic> response = await _client.dio.get<dynamic>(
        '/api/demand/forecasts',
        queryParameters: <String, dynamic>{
          'facilityId': facilityId,
          if (medicineId != null) 'medicineId': medicineId,
          'page': page,
          'pageSize': pageSize,
          'sortBy': 'generatedAt',
          'sortOrder': 'desc',
        },
      );

      return PagedResponse<DemandForecast>.fromJson(
        ApiClient.unwrap(response),
        DemandForecast.fromJson,
      );
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }

  /// GET /api/shortages
  Future<PagedResponse<ShortageAlert>> getShortages({
    required String facilityId,
    String? riskLevel,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final Response<dynamic> response = await _client.dio.get<dynamic>(
        '/api/shortages',
        queryParameters: <String, dynamic>{
          'facilityId': facilityId,
          if (riskLevel != null && riskLevel.isNotEmpty) 'riskLevel': riskLevel,
          'page': page,
          'pageSize': pageSize,
          'sortBy': 'generatedAt',
          'sortOrder': 'desc',
        },
      );

      return PagedResponse<ShortageAlert>.fromJson(
        ApiClient.unwrap(response),
        ShortageAlert.fromJson,
      );
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }

  /// GET /api/shortages/{id}
  Future<ShortageAlert> getShortageById(String id) async {
    try {
      final Response<dynamic> response =
          await _client.dio.get<dynamic>('/api/shortages/$id');

      return ShortageAlert.fromJson(ApiClient.unwrap(response));
    } catch (error) {
      throw ApiClient.toFailure(error);
    }
  }
}
