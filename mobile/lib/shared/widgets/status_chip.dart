import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/text_styles.dart';

class StatusChip extends StatelessWidget {
  final String status;

  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label = status;

    switch (status.toUpperCase()) {
      case 'DELIVERED':
        bg = AppColors.successLight;
        fg = AppColors.success;
        label = 'DELIVERED • Confirmed';
        break;
      case 'INTRANSIT':
      case 'IN_TRANSIT':
      case 'DISPATCHED':
        bg = AppColors.secondaryLight;
        fg = AppColors.secondary;
        label = 'IN TRANSIT';
        break;
      case 'APPROVED':
      case 'RESERVED':
        bg = AppColors.infoLight;
        fg = AppColors.info;
        label = 'APPROVED • Queued';
        break;
      case 'PENDING':
      case 'REQUESTED':
        bg = AppColors.warningLight;
        fg = AppColors.warning;
        label = 'PENDING';
        break;
      default:
        bg = AppColors.surfaceSubtle;
        fg = AppColors.textSecondary;
        label = status.toUpperCase();
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: AppTextStyles.badge.copyWith(color: fg),
      ),
    );
  }
}
