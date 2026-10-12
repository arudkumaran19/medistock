import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/network/signalr_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/state_views.dart';
import 'verify_shortage_screen.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final bool _isLoading = false;
  String? _errorMessage;
  StreamSubscription? _shortageSub;
  String? _facilityId;
  final List<Map<String, dynamic>> _liveAlerts = [];

  final List<String> _mockAlerts = ['alert-1', 'alert-2', 'alert-3'];

  @override
  void initState() {
    super.initState();
    _initSignalR();
  }

  Future<void> _initSignalR() async {
    final user = await SecureStorageService().getUser();
    _facilityId = user?['facilityId']?.toString() ?? 'a0000000-0000-0000-0000-000000000001';
    await SignalRClient().connect();
    await SignalRClient().joinFacilityGroup(_facilityId!);

    _shortageSub = SignalRClient().onShortageAlertCreated.listen((data) {
      if (mounted) {
        setState(() {
          _liveAlerts.insert(0, data);
        });
      }
    });
  }

  @override
  void dispose() {
    _shortageSub?.cancel();
    if (_facilityId != null) {
      SignalRClient().leaveFacilityGroup(_facilityId!);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('AI Shortage Risk & Alerts')),
        body: const LoadingView(label: 'Loading...'),
      );
    }
    if (_errorMessage != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('AI Shortage Risk & Alerts')),
        body: ErrorView(
          message: _errorMessage!,
          onRetry: () => setState(() => _errorMessage = null),
        ),
      );
    }
    if (_mockAlerts.isEmpty && _liveAlerts.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('AI Shortage Risk & Alerts')),
        body: const EmptyView(message: 'No items'),
      );
    }
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('AI Shortage Risk & Alerts'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Live Real-Time SignalR Alerts
          for (final alert in _liveAlerts) ...[
            _AlertCard(
              title: 'LIVE: Shortage Detected — ${alert['medicineName'] ?? 'Medicine'}',
              description: 'Stock: ${alert['currentStock'] ?? 0} units • ${alert['daysRemaining'] ?? 0} days cover remaining. Supplier lead time: ${alert['leadTimeDays'] ?? 10} days.',
              urgency: (alert['riskLevel']?.toString().toUpperCase() == 'HIGH') ? 'CRITICAL' : 'WARNING',
              time: 'Just now (Live)',
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => VerifyShortageScreen(shortageAlert: alert),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
          ],
          _AlertCard(
            title: 'Critical Stockout Prediction: Meropenem 1g IV',
            description: 'AI model predicts depletion within 36 hours based on local Dengue & ICU surge data. 2 surplus hubs nearby detected.',
            urgency: 'CRITICAL',
            time: '12m ago',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const VerifyShortageScreen(
                    shortageAlert: {
                      'id': 'b1111111-1111-1111-1111-111111111111',
                      'medicineName': 'Meropenem 1g IV Injection',
                      'currentStock': 12,
                      'daysRemaining': 2,
                      'leadTimeDays': 10,
                      'averageDailyConsumption': 20,
                      'riskLevel': 'HIGH',
                    },
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          _AlertCard(
            title: 'Low Batch Expiry Notice: Amoxicillin 500mg',
            description: 'Batch #AMX-2024-08 expires in 14 days. 120 strips remaining in Bay B4. Proactive reallocation recommended.',
            urgency: 'WARNING',
            time: '1h ago',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const VerifyShortageScreen(
                    shortageAlert: {
                      'id': 'b2222222-2222-2222-2222-222222222222',
                      'medicineName': 'Amoxicillin + Clavulanic Acid 625mg',
                      'currentStock': 45,
                      'daysRemaining': 5,
                      'leadTimeDays': 10,
                      'averageDailyConsumption': 15,
                      'riskLevel': 'MEDIUM',
                    },
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          _AlertCard(
            title: 'Cold Chain Telemetry Alert',
            description: 'Refrigerated Vault #2 temperature spiked to +7.8°C briefly (Normal range: 2°C-8°C). System auto-calibrated.',
            urgency: 'INFO',
            time: '3h ago',
            onTap: () {},
          ),
        ],
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final String title;
  final String description;
  final String urgency;
  final String time;
  final VoidCallback onTap;

  const _AlertCard({
    required this.title,
    required this.description,
    required this.urgency,
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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(6)),
                child: Text(urgency, style: AppTextStyles.badge.copyWith(color: Colors.white)),
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
