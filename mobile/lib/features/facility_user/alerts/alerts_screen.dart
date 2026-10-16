import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/signalr_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/state_views.dart';
import 'alerts_provider.dart';
import 'models/shortage_alert_model.dart';
import 'verify_shortage_screen.dart';

class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});

  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> {
  StreamSubscription? _shortageSub;
  StreamSubscription? _shortageDismissedSub;
  Timer? _pollTimer;

  bool get _isTestEnvironment {
    if (kIsWeb) return false;
    try {
      return Platform.environment.containsKey('FLUTTER_TEST');
    } catch (_) {
      return false;
    }
  }

  @override
  void initState() {
    super.initState();
    _initSignalR();
    _startPolling();
  }

  void _startPolling() {
    if (_isTestEnvironment) return;
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) {
        ref.read(alertsProvider.notifier).load();
      }
    });
  }

  Future<void> _initSignalR() async {
    if (_isTestEnvironment) return;
    try {
      await SignalRClient().connect();
      await SignalRClient().joinAllFacilityUsers();
    } catch (_) {}

    _shortageSub = SignalRClient().onShortageAlertCreated.listen((data) {
      if (mounted) {
        final alert = ShortageAlertModel.fromJson(data);
        ref.read(alertsProvider.notifier).addOrUpdate(alert);
      }
    });

    _shortageDismissedSub = SignalRClient().onShortageAlertDismissed.listen((data) {
      if (mounted) {
        final id = data['id']?.toString() ?? data['Id']?.toString();
        if (id != null && id.isNotEmpty) {
          ref.read(alertsProvider.notifier).removeAlert(id);
        }
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _shortageSub?.cancel();
    _shortageDismissedSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alertsAsync = ref.watch(alertsProvider);
    final openedAlerts = ref.watch(openedAlertsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('AI Shortage Risk & Alerts'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(alertsProvider.notifier).load(),
        child: alertsAsync.when(
          loading: () => const LoadingView(label: 'Loading shortage alerts...'),
          error: (err, _) => ErrorView(
            message: 'Failed to load shortage alerts: $err',
            onRetry: () => ref.read(alertsProvider.notifier).load(),
          ),
          data: (alerts) {
            if (alerts.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  EmptyView(message: 'No shortage alerts currently active'),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: alerts.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final alert = alerts[index];
                final isCritical = alert.severity.toUpperCase() == 'HIGH' ||
                    alert.severity.toUpperCase() == 'CRITICAL';
                final urgency = isCritical ? 'CRITICAL' : 'WARNING';
                final title = 'Shortage Risk: ${alert.medicineName}';
                final description = 'Stock: ${alert.currentStock} • Recommended reorder: ${alert.suggestedQuantity} units. Facility: ${alert.facilityName}';
                final isNew = !openedAlerts.contains(alert.id);

                return _AlertCard(
                  title: title,
                  description: description,
                  urgency: urgency,
                  isNew: isNew,
                  time: '${alert.createdAt.hour.toString().padLeft(2, '0')}:${alert.createdAt.minute.toString().padLeft(2, '0')}',
                  onTap: () {
                    ref.read(openedAlertsProvider.notifier).markAsOpened(alert.id);
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => VerifyShortageScreen(shortageAlert: alert.toJson()),
                      ),
                    );
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final String title;
  final String description;
  final String urgency;
  final bool isNew;
  final String time;
  final VoidCallback onTap;

  const _AlertCard({
    required this.title,
    required this.description,
    required this.urgency,
    required this.isNew,
    required this.time,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Color cardColor;
    Color badgeColor;

    switch (urgency) {
      case 'CRITICAL':
        cardColor = AppColors.errorLight;
        badgeColor = AppColors.error;
        break;
      case 'WARNING':
        cardColor = AppColors.warningLight;
        badgeColor = AppColors.warning;
        break;
      default:
        cardColor = AppColors.infoLight;
        badgeColor = AppColors.info;
        break;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: badgeColor.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(6)),
                    child: Text(urgency, style: AppTextStyles.badge.copyWith(color: Colors.white)),
                  ),
                  if (isNew) ...[
                    const SizedBox(width: 8),
                    Container(
                      key: const Key('new-alert-chip'),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'NEW',
                        style: AppTextStyles.badge.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              Text(time, style: AppTextStyles.bodySmall),
            ],
          ),
          const SizedBox(height: 10),
          Text(title, style: AppTextStyles.titleSmall),
          const SizedBox(height: 4),
          Text(description, style: AppTextStyles.bodyMedium),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: badgeColor,
              minimumSize: const Size(double.infinity, 38),
            ),
            child: const Text('Resolve Alert / Create Request'),
          ),
        ],
      ),
    );
  }
}
