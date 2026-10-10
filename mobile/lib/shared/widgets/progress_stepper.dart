import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/text_styles.dart';

class ProgressStepper extends StatelessWidget {
  final int currentStep; // 1: Placed, 2: Verified/Approved, 3: InTransit, 4: Delivered
  final List<String> stepLabels;

  const ProgressStepper({
    super.key,
    required this.currentStep,
    this.stepLabels = const ['Placed', 'Verified', 'Transit', 'Arrival'],
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(stepLabels.length, (index) {
          final stepNum = index + 1;
          final isDone = stepNum <= currentStep;
          final isCurrent = stepNum == currentStep;

          Color stepColor = isDone ? AppColors.primary : AppColors.textMuted;
          if (isCurrent) stepColor = AppColors.secondary;

          return Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: isDone ? stepColor : Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: stepColor,
                            width: 2,
                          ),
                        ),
                        child: Center(
                          child: isDone
                              ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                              : Text(
                                  '$stepNum',
                                  style: AppTextStyles.badge.copyWith(color: stepColor),
                                ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        stepLabels[index],
                        style: AppTextStyles.bodySmall.copyWith(
                          fontSize: 10,
                          fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                          color: isCurrent ? AppColors.textPrimary : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                if (index < stepLabels.length - 1)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: stepNum < currentStep ? AppColors.primary : AppColors.border,
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }
}
