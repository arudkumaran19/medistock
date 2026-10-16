import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../auth/presentation/auth_controller.dart';
import 'data/shortage_repository.dart';
import 'models/shortage_alert_model.dart';

final openedAlertsProvider = StateNotifierProvider<OpenedAlertsNotifier, Set<String>>((ref) {
  return OpenedAlertsNotifier();
});

class OpenedAlertsNotifier extends StateNotifier<Set<String>> {
  OpenedAlertsNotifier() : super({}) {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList('opened_shortage_alert_ids') ?? [];
      state = list.toSet();
    } catch (_) {}
  }

  Future<void> markAsOpened(String alertId) async {
    if (state.contains(alertId)) return;
    final updated = {...state, alertId};
    state = updated;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList('opened_shortage_alert_ids', updated.toList());
    } catch (_) {}
  }
}

final alertsProvider = StateNotifierProvider<AlertsNotifier, AsyncValue<List<ShortageAlertModel>>>((ref) {
  final user = ref.watch(authControllerProvider).user;
  return AlertsNotifier(ref.watch(shortageRepositoryProvider), facilityId: user?.facilityId);
});

final unreadAlertCountProvider = Provider<int>((ref) {
  final alertsAsync = ref.watch(alertsProvider);
  final openedIds = ref.watch(openedAlertsProvider);
  return alertsAsync.maybeWhen(
    data: (alerts) => alerts.where((a) => !openedIds.contains(a.id)).length,
    orElse: () => 0,
  );
});

class AlertsNotifier extends StateNotifier<AsyncValue<List<ShortageAlertModel>>> {
  final ShortageRepository _repo;
  final String? facilityId;

  AlertsNotifier(this._repo, {this.facilityId}) : super(const AsyncValue.loading()) {
    load();
  }

  Future<void> load() async {
    try {
      final alerts = await _repo.getMyAlerts(facilityId: facilityId);
      final activeAlerts = alerts.where((a) => a.status.toUpperCase() != 'DISMISSED').toList();
      // Sort by createdAt descending so newest is first
      activeAlerts.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      state = AsyncValue.data(activeAlerts);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void addOrUpdate(ShortageAlertModel alert) {
    if (facilityId != null &&
        facilityId!.isNotEmpty &&
        alert.facilityId.isNotEmpty &&
        alert.facilityId.toLowerCase() != facilityId!.toLowerCase()) {
      return;
    }

    if (alert.status.toUpperCase() == 'DISMISSED') {
      removeAlert(alert.id);
      return;
    }

    final current = state.valueOrNull ?? [];
    final exists = current.any((a) => a.id == alert.id);
    List<ShortageAlertModel> updated;
    if (!exists) {
      updated = [alert, ...current];
    } else {
      updated = current.map((a) => a.id == alert.id ? alert : a).toList();
    }
    updated.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    state = AsyncValue.data(updated);
  }

  void removeAlert(String alertId) {
    final current = state.valueOrNull ?? [];
    final updated = current.where((a) => a.id != alertId).toList();
    state = AsyncValue.data(updated);
  }
}
