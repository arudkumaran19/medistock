import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/models/paged_response.dart';
import '../data/demand_repository.dart';
import '../domain/demand_models.dart';


/// Riverpod wiring for the Demand & Shortage feature.
/// Sathurstiga S. (IT24103156).
///
/// See docs/adr/ADR-003-flutter-state.md for why Riverpod is used.

/// Facility the signed-in officer works at.
///
/// Overridden at app start from the authenticated session. The seeded demonstration
/// facility is the default so the feature is runnable before authentication lands.
final Provider<String> currentFacilityIdProvider = Provider<String>(
  (Ref ref) => 'b1000000-0000-0000-0000-000000000002',
);

/// Shared HTTP client for this vertical.
///
/// develop's core/network/ApiClient exposes no Riverpod provider - the rest of the
/// app constructs it directly - so this vertical declares its own. The client reads
/// the bearer token from ApiClient.globalAuthToken, which the shared auth service
/// sets on sign-in, so no interceptor wiring is needed here.
final Provider<ApiClient> apiClientProvider = Provider<ApiClient>(
  (Ref ref) => ApiClient(),
);

final Provider<DemandRepository> demandRepositoryProvider = Provider<DemandRepository>(
  (Ref ref) => DemandRepository.fromApiClient(ref.watch(apiClientProvider)),
);

/// Shortage alerts for the current facility, optionally filtered by risk level.
final FutureProviderFamily<PagedResponse<ShortageAlert>, String?> shortageAlertsProvider =
    FutureProvider.family<PagedResponse<ShortageAlert>, String?>(
  (Ref ref, String? riskLevel) {
    return ref.watch(demandRepositoryProvider).getShortages(
          facilityId: ref.watch(currentFacilityIdProvider),
          riskLevel: riskLevel,
        );
  },
);

/// Stored forecasts for the current facility.
final FutureProvider<PagedResponse<DemandForecast>> forecastsProvider =
    FutureProvider<PagedResponse<DemandForecast>>(
  (Ref ref) {
    return ref.watch(demandRepositoryProvider).getForecasts(
          facilityId: ref.watch(currentFacilityIdProvider),
        );
  },
);

/// Consumption history for the current facility, optionally searched.
final FutureProviderFamily<PagedResponse<ConsumptionRecord>, String?> consumptionHistoryProvider =
    FutureProvider.family<PagedResponse<ConsumptionRecord>, String?>(
  (Ref ref, String? search) {
    return ref.watch(demandRepositoryProvider).getConsumption(
          facilityId: ref.watch(currentFacilityIdProvider),
          search: search,
        );
  },
);

/// State of the consumption entry form.
class ConsumptionEntryState {
  const ConsumptionEntryState({
    this.isSubmitting = false,
    this.errorMessage,
    this.submittedId,
  });

  final bool isSubmitting;
  final String? errorMessage;
  final String? submittedId;

  bool get isSuccess => submittedId != null;

  ConsumptionEntryState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    String? submittedId,
  }) {
    return ConsumptionEntryState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: errorMessage,
      submittedId: submittedId,
    );
  }
}

/// Submits a consumption entry and exposes the outcome to the screen.
class ConsumptionEntryController extends StateNotifier<ConsumptionEntryState> {
  ConsumptionEntryController(this._repository, this._facilityId)
      : super(const ConsumptionEntryState());

  final DemandRepository _repository;
  final String _facilityId;

  Future<void> submit({
    required String medicineId,
    required double quantityUsed,
    required DateTime consumptionDate,
    String source = 'FLUTTER_CONSUMPTION_ENTRY',
    String? notes,
  }) async {
    state = const ConsumptionEntryState(isSubmitting: true);

    try {
      final ConsumptionRecord record = await _repository.recordConsumption(
        ConsumptionEntry(
          facilityId: _facilityId,
          medicineId: medicineId,
          quantityUsed: quantityUsed,
          consumptionDate: consumptionDate,
          source: source,
          notes: notes,
        ),
      );

      state = ConsumptionEntryState(submittedId: record.id);
    } on ApiFailure catch (failure) {
      // The backend stays authoritative: its rejection message is shown as-is.
      state = ConsumptionEntryState(errorMessage: failure.message);
    }
  }

  void reset() => state = const ConsumptionEntryState();
}

final StateNotifierProvider<ConsumptionEntryController, ConsumptionEntryState>
    consumptionEntryControllerProvider =
    StateNotifierProvider<ConsumptionEntryController, ConsumptionEntryState>(
  (Ref ref) => ConsumptionEntryController(
    ref.watch(demandRepositoryProvider),
    ref.watch(currentFacilityIdProvider),
  ),
);

/// Outcome of a mutation triggered from a list screen.
class DemandActionState {
  const DemandActionState({this.isBusy = false, this.errorMessage});

  final bool isBusy;
  final String? errorMessage;
}

/// Edit, delete and acknowledge actions the field app can perform.
///
/// Correcting a quantity and acknowledging an alert are field operations. Raising or
/// deleting an alert is management and stays in the React console, per the
/// blueprint's client responsibility split.
class DemandActionsController extends StateNotifier<DemandActionState> {
  DemandActionsController(this._ref) : super(const DemandActionState());

  final Ref _ref;

  DemandRepository get _repository => _ref.read(demandRepositoryProvider);

  Future<bool> updateConsumption(String id, ConsumptionEntry entry) =>
      _run(() => _repository.updateConsumption(id, entry));

  Future<bool> deleteConsumption(String id) =>
      _run(() => _repository.deleteConsumption(id));

  Future<bool> resolveShortage(String id) =>
      _run(() => _repository.resolveShortage(id));

  Future<bool> acknowledgeShortage(String id) =>
      _run(() => _repository.updateShortageStatus(id, 'ACKNOWLEDGED'));

  /// Runs an action, then invalidates the lists so the screens reload.
  Future<bool> _run(Future<void> Function() action) async {
    state = const DemandActionState(isBusy: true);

    try {
      await action();

      // A correction changes the averages later forecasts read, so every demand list
      // is invalidated rather than just the one on screen.
      _ref.invalidate(shortageAlertsProvider);
      _ref.invalidate(consumptionHistoryProvider);
      _ref.invalidate(forecastsProvider);

      state = const DemandActionState();
      return true;
    } on ApiFailure catch (failure) {
      state = DemandActionState(errorMessage: failure.message);
      return false;
    }
  }

  void clearError() => state = const DemandActionState();
}

final StateNotifierProvider<DemandActionsController, DemandActionState>
    demandActionsProvider =
    StateNotifierProvider<DemandActionsController, DemandActionState>(
  (Ref ref) => DemandActionsController(ref),
);

/// Client-side validation for the consumption entry form.
///
/// Mirrors the backend rules so an obviously invalid entry is caught before the round
/// trip. The backend remains authoritative; this never replaces it.
class ConsumptionEntryValidator {
  const ConsumptionEntryValidator._();

  static String? validateQuantity(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return 'Enter the quantity used.';
    }

    final double? value = double.tryParse(raw.trim());

    if (value == null) {
      return 'Enter a valid number.';
    }

    if (value <= 0) {
      return 'Quantity must be greater than zero.';
    }

    return null;
  }

  static String? validateMedicineId(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return 'Select a medicine.';
    }

    return null;
  }

  static String? validateDate(DateTime? date) {
    if (date == null) {
      return 'Select the date the medicine was used.';
    }

    // Compare calendar dates in the SAME frame of reference. The date picker hands
    // back a local DateTime, so "today" must be the local calendar date too.
    // Taking today from UTC while the picked date is local made every date ahead of
    // UTC read as the future: east of Greenwich, between local midnight and the UTC
    // offset, a store officer could not record today's consumption at all.
    final DateTime today = DateTime.now();
    final DateTime justDate = DateTime.utc(date.year, date.month, date.day);
    final DateTime justToday = DateTime.utc(today.year, today.month, today.day);

    if (justDate.isAfter(justToday)) {
      // Consumption records what has already been used.
      return 'The date cannot be in the future.';
    }

    return null;
  }

  static String? validateNotes(String? raw) {
    if (raw != null && raw.length > 512) {
      return 'Notes must be 512 characters or fewer.';
    }

    return null;
  }
}
