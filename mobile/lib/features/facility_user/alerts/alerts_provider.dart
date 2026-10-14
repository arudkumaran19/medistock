import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'data/shortage_repository.dart';
import 'models/shortage_alert_model.dart';

final alertsProvider = StateNotifierProvider<AlertsNotifier, AsyncValue<List<ShortageAlertModel>>>((ref) {
  return AlertsNotifier(ref.watch(shortageRepositoryProvider));
});

class AlertsNotifier extends StateNotifier<AsyncValue<List<ShortageAlertModel>>> {
  final ShortageRepository _repo;

  AlertsNotifier(this._repo) : super(const AsyncValue.loading()) {
    load();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final alerts = await _repo.getMyAlerts();
      state = AsyncValue.data(alerts);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void addOrUpdate(ShortageAlertModel alert) {
    final current = state.valueOrNull ?? [];
    final exists = current.any((a) => a.id == alert.id);
    if (!exists) {
      state = AsyncValue.data([alert, ...current]);
    } else {
      final updated = current.map((a) => a.id == alert.id ? alert : a).toList();
      state = AsyncValue.data(updated);
    }
  }
}
