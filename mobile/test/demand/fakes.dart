import 'package:medistock/features/demand/data/demand_repository.dart';
import 'package:medistock/features/demand/domain/demand_models.dart';
import 'package:medistock/shared/models/paged_response.dart';

/// Test doubles for the Demand & Shortage widget tests.
/// Sathurstiga S. (IT24103156).

/// A repository whose responses each test controls.
class FakeDemandRepository implements DemandRepository {
  FakeDemandRepository({
    this.shortages,
    this.forecasts,
    this.consumption,
    this.shortageError,
    this.forecastError,
    this.consumptionError,
    this.recordError,
  });

  PagedResponse<ShortageAlert>? shortages;
  PagedResponse<DemandForecast>? forecasts;
  PagedResponse<ConsumptionRecord>? consumption;

  ApiFailure? shortageError;
  ApiFailure? forecastError;
  ApiFailure? consumptionError;
  ApiFailure? recordError;

  ConsumptionEntry? lastEntry;
  String? lastRiskFilter;
  String? lastSearch;

  String? updatedConsumptionId;
  String? deletedConsumptionId;
  String? resolvedShortageId;
  String? updatedShortageId;
  String? updatedShortageStatus;

  @override
  Future<PagedResponse<ShortageAlert>> getShortages({
    required String facilityId,
    String? riskLevel,
    int page = 1,
    int pageSize = 20,
  }) async {
    lastRiskFilter = riskLevel;

    if (shortageError != null) {
      throw shortageError!;
    }

    return shortages ?? emptyPage<ShortageAlert>();
  }

  @override
  Future<PagedResponse<DemandForecast>> getForecasts({
    required String facilityId,
    String? medicineId,
    int page = 1,
    int pageSize = 20,
  }) async {
    if (forecastError != null) {
      throw forecastError!;
    }

    return forecasts ?? emptyPage<DemandForecast>();
  }

  @override
  Future<PagedResponse<ConsumptionRecord>> getConsumption({
    required String facilityId,
    String? medicineId,
    String? search,
    int page = 1,
    int pageSize = 20,
    String sortBy = 'consumptionDate',
    String sortOrder = 'desc',
  }) async {
    lastSearch = search;

    if (consumptionError != null) {
      throw consumptionError!;
    }

    return consumption ?? emptyPage<ConsumptionRecord>();
  }

  @override
  Future<ConsumptionRecord> recordConsumption(ConsumptionEntry entry) async {
    lastEntry = entry;

    if (recordError != null) {
      throw recordError!;
    }

    return ConsumptionRecord(
      id: 'created-1',
      facilityId: entry.facilityId,
      medicineId: entry.medicineId,
      quantityUsed: entry.quantityUsed,
      consumptionDate: entry.consumptionDate,
      source: entry.source,
      notes: entry.notes,
    );
  }

  @override
  Future<ShortageAlert> getShortageById(String id) async {
    if (shortageError != null) {
      throw shortageError!;
    }

    return buildAlert(id: id);
  }

  @override
  Future<ConsumptionRecord> updateConsumption(String id, ConsumptionEntry entry) async {
    lastEntry = entry;
    updatedConsumptionId = id;

    if (recordError != null) {
      throw recordError!;
    }

    return ConsumptionRecord(
      id: id,
      facilityId: entry.facilityId,
      medicineId: entry.medicineId,
      quantityUsed: entry.quantityUsed,
      consumptionDate: entry.consumptionDate,
      source: entry.source,
      notes: entry.notes,
    );
  }

  @override
  Future<void> deleteConsumption(String id) async {
    deletedConsumptionId = id;

    if (recordError != null) {
      throw recordError!;
    }
  }

  @override
  Future<ShortageAlert> resolveShortage(String id) async {
    resolvedShortageId = id;

    if (shortageError != null) {
      throw shortageError!;
    }

    return buildAlert(id: id, status: 'RESOLVED');
  }

  @override
  Future<ShortageAlert> updateShortageStatus(String id, String status) async {
    updatedShortageId = id;
    updatedShortageStatus = status;

    if (shortageError != null) {
      throw shortageError!;
    }

    return buildAlert(id: id, status: status);
  }
}

PagedResponse<T> emptyPage<T>() => PagedResponse<T>(
      items: const <Never>[],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    );

PagedResponse<T> pageOf<T>(List<T> items) => PagedResponse<T>(
      items: items,
      page: 1,
      pageSize: 20,
      totalCount: items.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    );

/// The blueprint worked example: 120 units, 20/day, lead time 10 => 6 days, HIGH.
ShortageAlert buildAlert({
  String id = 'a1',
  int? daysRemaining = 6,
  String riskLevel = 'HIGH',
  bool requiresTransfer = true,
  double averageDailyConsumption = 20,
  String status = 'OPEN',
}) {
  return ShortageAlert(
    id: id,
    facilityId: 'f1',
    medicineId: 'm1',
    demandForecastId: 'fc1',
    currentStock: 120,
    averageDailyConsumption: averageDailyConsumption,
    daysRemaining: daysRemaining,
    projectedStockoutDate: daysRemaining == null ? null : DateTime.utc(2026, 9, 27),
    leadTimeDays: 10,
    riskLevel: riskLevel,
    requiresTransfer: requiresTransfer,
    generatedAt: DateTime.utc(2026, 9, 21, 8),
    status: status,
  );
}

DemandForecast buildForecast({String method = 'MOVING_AVERAGE'}) {
  return DemandForecast(
    id: 'fc1',
    facilityId: 'f1',
    medicineId: 'm1',
    forecastDate: DateTime.utc(2026, 10, 21),
    predictedDemand: 600,
    averageDailyConsumption: 20,
    method: method,
    windowDays: 30,
    horizonDays: 30,
    confidenceScore: 1,
    leadTimeDays: 10,
    generatedAt: DateTime.utc(2026, 9, 21, 8),
    status: 'ACTIVE',
  );
}

ConsumptionRecord buildRecord({double quantityUsed = 20, String source = 'SEED'}) {
  return ConsumptionRecord(
    id: 'r1',
    facilityId: 'f1',
    medicineId: 'm1',
    quantityUsed: quantityUsed,
    consumptionDate: DateTime.utc(2026, 9, 20),
    source: source,
  );
}
