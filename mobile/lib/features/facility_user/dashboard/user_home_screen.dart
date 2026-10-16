import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/signalr_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/progress_stepper.dart';
import '../../../shared/widgets/status_chip.dart';
import '../../auth/presentation/auth_controller.dart';
import '../alerts/alerts_provider.dart';
import '../alerts/models/shortage_alert_model.dart';
import '../alerts/verify_shortage_screen.dart';
import '../requests/data/transfer_repository.dart';

class UserHomeScreen extends ConsumerStatefulWidget {
  const UserHomeScreen({super.key});

  @override
  ConsumerState<UserHomeScreen> createState() => _UserHomeScreenState();
}

class _UserHomeScreenState extends ConsumerState<UserHomeScreen> {
  int _currentIndex = 0;
  StreamSubscription? _shortageSub;
  StreamSubscription? _shortageDismissedSub;
  Timer? _pollTimer;
  String? _facilityId;

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
    if (!_isTestEnvironment) {
      final authState = ref.read(authControllerProvider);
      _facilityId = authState.user?.facilityId;
      if (_facilityId != null && _facilityId!.isNotEmpty) {
        SignalRClient().connect().then((_) {
          SignalRClient().joinFacilityGroup(_facilityId!);
        });
      }

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

      _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
        if (mounted) {
          ref.read(alertsProvider.notifier).load();
        }
      });
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    if (!_isTestEnvironment && _facilityId != null && _facilityId!.isNotEmpty) {
      SignalRClient().leaveFacilityGroup(_facilityId!);
    }
    _shortageSub?.cancel();
    _shortageDismissedSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;
    final unreadCount = ref.watch(unreadAlertCountProvider);
    final alertsAsync = ref.watch(alertsProvider);
    final openedAlerts = ref.watch(openedAlertsProvider);
    final alerts = alertsAsync.valueOrNull ?? [];
    final unreadAlerts = alerts.where((a) => !openedAlerts.contains(a.id)).toList();
    final latestUnreadAlert = unreadAlerts.isNotEmpty ? unreadAlerts.first : null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.local_pharmacy_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('MediStock AI', style: AppTextStyles.titleMedium),
                Text(user?.facilityName ?? 'Facility Portal', style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
              ],
            ),
          ],
        ),
        actions: [
          Badge(
            key: const Key('unread-alert-badge'),
            isLabelVisible: unreadCount > 0,
            label: Text('$unreadCount'),
            backgroundColor: AppColors.error,
            child: IconButton(
              key: const Key('bell-notifications-button'),
              icon: const Icon(Icons.notifications_none_rounded),
              onPressed: () => context.push('/user/alerts'),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.primarySurface,
              child: Text(
                user?.name.substring(0, 1) ?? 'K',
                style: AppTextStyles.badge.copyWith(color: AppColors.primaryDark),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Sync pill
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primarySurface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                      Text('Grid Connected • AI Sync Active (2m ago)', style: AppTextStyles.bodySmall.copyWith(color: AppColors.primaryDark, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                const Spacer(),
                Text('ID: EXP-CH-408', style: AppTextStyles.bodySmall),
              ],
            ),

            const SizedBox(height: 14),

            // User Greeting
            Text(
              'Good morning, ${user?.name ?? "User"}',
              style: AppTextStyles.displayMedium.copyWith(fontSize: 22),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 14, color: AppColors.primary),
                const SizedBox(width: 4),
                Text(
                  user?.facilityName ?? 'Facility Portal',
                  style: AppTextStyles.bodyMedium,
                ),
              ],
            ),

            if (latestUnreadAlert != null) ...[
              const SizedBox(height: 16),
              _ShortageAlertNotificationCard(
                alert: latestUnreadAlert,
                onTap: () {
                  ref.read(openedAlertsProvider.notifier).markAsOpened(latestUnreadAlert.id);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => VerifyShortageScreen(shortageAlert: latestUnreadAlert.toJson()),
                    ),
                  );
                },
              ),
            ],

            const SizedBox(height: 20),

            // OPERATIONAL VITALS
            Text('OPERATIONAL VITALS', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            Row(
              children: [
                // Total Stock Items Box
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Total Stock Items', style: AppTextStyles.bodySmall),
                            const Icon(Icons.inventory_2_outlined, size: 16, color: AppColors.primary),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text('14,820', style: AppTextStyles.displayLarge.copyWith(fontSize: 26)),
                        const SizedBox(height: 4),
                        Text('+5.2% vs previous wk', style: AppTextStyles.bodySmall.copyWith(color: AppColors.success, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Low Stock Alerts Box
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.errorLight,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.error.withOpacity(0.3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Low Stock Alerts', style: AppTextStyles.bodySmall.copyWith(color: AppColors.error)),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Text('3', style: AppTextStyles.displayLarge.copyWith(fontSize: 26, color: AppColors.error)),
                            const SizedBox(width: 6),
                            Text('CRITICAL ITEMS', style: AppTextStyles.badge.copyWith(color: AppColors.error)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('Amoxicillin, Ceftriaxone...', style: AppTextStyles.bodySmall.copyWith(color: AppColors.error, fontSize: 11), overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // QUICK OPERATIONS 2x2 GRID
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('QUICK OPERATIONS', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
                Text('1-Tap Portals', style: AppTextStyles.bodySmall),
              ],
            ),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, constraints) {
                final crossAxisCount = constraints.maxWidth > 600 ? 4 : 2;
                return GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: crossAxisCount,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.45,
                  children: [
                    _QuickOpCard(
                      icon: Icons.add_circle_outline_rounded,
                      iconBg: AppColors.primarySurface,
                      iconColor: AppColors.primary,
                      title: 'New Request',
                      subtitle: 'Request stock from nearby hubs',
                      onTap: () => context.push('/user/requests/new'),
                    ),
                    _QuickOpCard(
                      icon: Icons.inventory_rounded,
                      iconBg: AppColors.secondaryLight,
                      iconColor: AppColors.secondary,
                      title: 'My Inventory',
                      subtitle: 'Real-time batch & expiry audit',
                      onTap: () => context.push('/user/inventory'),
                    ),
                    _QuickOpCard(
                      icon: Icons.alt_route_rounded,
                      iconBg: AppColors.infoLight,
                      iconColor: AppColors.info,
                      title: 'Track Delivery',
                      subtitle: 'Live GPS vehicle telemetry',
                      onTap: () => context.push('/user/requests'),
                    ),
                    _QuickOpCard(
                      icon: Icons.auto_graph_rounded,
                      iconBg: AppColors.warningLight,
                      iconColor: AppColors.warning,
                      title: 'Forecast AI',
                      subtitle: 'Predictive 14-day stockout AI',
                      onTap: () => context.push('/user/alerts'),
                    ),
                    _QuickOpCard(
                      icon: Icons.qr_code_scanner_rounded,
                      iconBg: AppColors.primarySurface,
                      iconColor: AppColors.primary,
                      title: 'Scan Batch',
                      subtitle: 'DataMatrix barcode lookup',
                      onTap: () => context.push('/inventory/scan'),
                    ),
                    _QuickOpCard(
                      icon: Icons.psychology_rounded,
                      iconBg: AppColors.secondaryLight,
                      iconColor: AppColors.secondary,
                      title: 'AI Agent',
                      subtitle: 'Autonomous demand planning',
                      onTap: () => context.push('/demand/agent'),
                    ),
                  ],
                );
              },
            ),

            const SizedBox(height: 24),

            ref.watch(myRequestsProvider(null)).when(
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
              data: (requests) {
                final inTransitRequest = requests.where((r) {
                  final s = r.status.toLowerCase();
                  return s == 'intransit' || s == 'in transit';
                }).firstOrNull;

                if (inTransitRequest == null) return const SizedBox.shrink();

                final medicineName = inTransitRequest.items.isNotEmpty
                    ? inTransitRequest.items.first.itemName
                    : 'Emergency Requisition';
                final routeText =
                    '${inTransitRequest.sourceFacilityName} ➔ ${inTransitRequest.destinationFacilityName}';

                return Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: InkWell(
                    onTap: () => context.push('/user/requests/${inTransitRequest.id}'),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.info.withOpacity(0.4)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.ac_unit_rounded, size: 18, color: AppColors.info),
                                  const SizedBox(width: 8),
                                  Text('Live Transit Corridor', style: AppTextStyles.titleMedium),
                                ],
                              ),
                              Text(
                                inTransitRequest.transferNumber.isNotEmpty
                                    ? inTransitRequest.transferNumber
                                    : '#REQ-${inTransitRequest.id.substring(0, 8)}',
                                style: AppTextStyles.badge.copyWith(color: AppColors.info),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          const ProgressStepper(currentStep: 3),
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  medicineName,
                                  style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.w600),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  routeText,
                                  style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                                  textAlign: TextAlign.end,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),

            // RECENT REQUESTS
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('RECENT REQUESTS', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
                TextButton(
                  onPressed: () => context.push('/user/requests'),
                  child: Text('View All', style: AppTextStyles.bodySmall.copyWith(color: AppColors.primary, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 8),

            ref.watch(myRequestsProvider(null)).when(
              loading: () => const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())),
              error: (err, _) => Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text('Failed to load recent requests', style: AppTextStyles.bodyMedium),
              ),
              data: (requests) {
                if (requests.isEmpty) {
                  return Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Center(
                      child: Text('No requisitions recorded yet.', style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textMuted)),
                    ),
                  );
                }

                final displayRequests = requests.take(3).toList();
                return Column(
                  children: displayRequests.map((r) {
                    final medicineName = r.items.isNotEmpty ? r.items.first.itemName : 'Requisition Item';
                    final details = r.items.isNotEmpty
                        ? '${r.items.first.requestedQuantity} ${r.items.first.unitOfMeasure}'
                        : 'Requisition';
                    final route = '${r.sourceFacilityName} ➔ ${r.destinationFacilityName}';
                    final idLabel = r.transferNumber.isNotEmpty ? r.transferNumber : '#REQ-${r.id.substring(0, 8)}';

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _RecentRequestCard(
                        id: idLabel,
                        medicineName: medicineName,
                        details: details,
                        route: route,
                        status: r.status.toUpperCase(),
                        onTap: () => context.push('/user/requests/${r.id}'),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        onTap: (index) {
          setState(() => _currentIndex = index);
          if (index == 1) context.push('/user/inventory');
          if (index == 2) context.push('/user/requests');
          if (index == 3) context.push('/user/alerts');
          if (index == 4) context.push('/user/profile');
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.grid_view_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.inventory_2_rounded), label: 'Inventory'),
          BottomNavigationBarItem(icon: Icon(Icons.swap_horiz_rounded), label: 'Requests'),
          BottomNavigationBarItem(icon: Icon(Icons.warning_amber_rounded), label: 'Alerts'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}

class _QuickOpCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _QuickOpCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 6),
            Text(title, style: AppTextStyles.titleSmall),
            const SizedBox(height: 2),
            Text(subtitle, style: AppTextStyles.bodySmall.copyWith(fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _RecentRequestCard extends StatelessWidget {
  final String id;
  final String medicineName;
  final String details;
  final String route;
  final String status;
  final VoidCallback onTap;

  const _RecentRequestCard({
    required this.id,
    required this.medicineName,
    required this.details,
    required this.route,
    required this.status,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(id, style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
                StatusChip(status: status),
              ],
            ),
            const SizedBox(height: 8),
            Text(medicineName, style: AppTextStyles.titleSmall.copyWith(fontSize: 16)),
            const SizedBox(height: 2),
            Text(details, style: AppTextStyles.bodySmall),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.alt_route_rounded, size: 14, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(child: Text(route, style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ShortageAlertNotificationCard extends StatelessWidget {
  final ShortageAlertModel alert;
  final VoidCallback onTap;

  const _ShortageAlertNotificationCard({
    required this.alert,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isCritical = alert.severity.toUpperCase() == 'HIGH' ||
        alert.severity.toUpperCase() == 'CRITICAL';
    final badgeColor = isCritical ? AppColors.error : AppColors.warning;
    final cardBg = isCritical ? AppColors.errorLight : AppColors.warningLight;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: const Key('shortage-notification-banner'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: badgeColor.withOpacity(0.4)),
            boxShadow: [
              BoxShadow(
                color: badgeColor.withOpacity(0.08),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.warning_amber_rounded, color: badgeColor, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: badgeColor,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isCritical ? 'CRITICAL ALERT' : 'SHORTAGE ALERT',
                            style: AppTextStyles.badge.copyWith(color: Colors.white, fontSize: 10),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'NEW',
                            style: AppTextStyles.badge.copyWith(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Shortage Risk: ${alert.medicineName}',
                      style: AppTextStyles.titleSmall.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Stock: ${alert.currentStock} units • Reorder: ${alert.suggestedQuantity} units (${alert.facilityName})',
                      style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}
