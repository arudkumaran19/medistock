import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('AI Shortage Risk & Alerts'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _AlertCard(
            title: 'Critical Stockout Prediction: Meropenem 1g IV',
            description: 'AI model predicts depletion within 36 hours based on local Dengue & ICU surge data. 2 surplus hubs nearby detected.',
            urgency: 'CRITICAL',
            time: '12m ago',
            onTap: () => context.push('/user/requests/new'),
          ),
          const SizedBox(height: 12),
          _AlertCard(
            title: 'Low Batch Expiry Notice: Amoxicillin 500mg',
            description: 'Batch #AMX-2024-08 expires in 14 days. 120 strips remaining in Bay B4. Proactive reallocation recommended.',
            urgency: 'WARNING',
            time: '1h ago',
            onTap: () {},
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
