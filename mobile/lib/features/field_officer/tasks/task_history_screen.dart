import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/status_chip.dart';

class TaskHistoryScreen extends StatelessWidget {
  const TaskHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Officer Delivery History'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _HistoryCard(
            id: '#REQ-2024-8810',
            medicine: 'Paracetamol 650mg Tablets',
            route: 'MedPlus Guindy Hub ➔ Apollo Anna Nagar',
            date: 'Today, 02:30 PM',
            distance: '14.2 km',
          ),
          SizedBox(height: 12),
          _HistoryCard(
            id: '#REQ-2024-8790',
            medicine: 'Amoxicillin 500mg Capsules',
            route: 'Tambaram Depot ➔ Kilpauk Govt Hospital',
            date: 'Yesterday, 11:15 AM',
            distance: '22.8 km',
          ),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final String id;
  final String medicine;
  final String route;
  final String date;
  final String distance;

  const _HistoryCard({
    required this.id,
    required this.medicine,
    required this.route,
    required this.date,
    required this.distance,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
              Text(id, style: AppTextStyles.titleSmall.copyWith(color: AppColors.secondary)),
              const StatusChip(status: 'DELIVERED'),
            ],
          ),
          const SizedBox(height: 8),
          Text(medicine, style: AppTextStyles.titleMedium),
          const SizedBox(height: 4),
          Text(route, style: AppTextStyles.bodySmall),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(date, style: AppTextStyles.bodySmall),
              Text(distance, style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }
}
