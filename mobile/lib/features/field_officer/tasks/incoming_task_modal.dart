import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

class IncomingTaskModal extends StatefulWidget {
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const IncomingTaskModal({
    super.key,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  State<IncomingTaskModal> createState() => _IncomingTaskModalState();
}

class _IncomingTaskModalState extends State<IncomingTaskModal> {
  int _secondsRemaining = 30;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsRemaining > 1) {
        setState(() => _secondsRemaining--);
      } else {
        _timer?.cancel();
        widget.onDecline();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppColors.secondaryLight, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    const Icon(Icons.flash_on_rounded, size: 14, color: AppColors.secondary),
                    const SizedBox(width: 4),
                    Text('URGENT DISPATCH ALERT', style: AppTextStyles.badge.copyWith(color: AppColors.secondary)),
                  ],
                ),
              ),
              Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 38,
                    height: 38,
                    child: CircularProgressIndicator(
                      value: _secondsRemaining / 30,
                      color: AppColors.secondary,
                      backgroundColor: AppColors.surfaceSubtle,
                      strokeWidth: 3,
                    ),
                  ),
                  Text('$_secondsRemaining', style: AppTextStyles.titleSmall.copyWith(fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),

          const SizedBox(height: 16),

          Text('Cold-Chain Medicine Requisition', style: AppTextStyles.displayMedium.copyWith(fontSize: 20)),
          Text('Human Albumin 20% & Meropenem 1g IV • Cryo-Vault Payload', style: AppTextStyles.bodyMedium),

          const SizedBox(height: 20),

          // Route Details
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceSubtle,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    const Icon(Icons.store_rounded, color: AppColors.success, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('PICKUP FACILITY', style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
                          Text('Kilpauk Medical Depot, Bay 4', style: AppTextStyles.titleSmall),
                        ],
                      ),
                    ),
                    Text('3.2 km', style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(height: 1),
                ),
                Row(
                  children: [
                    const Icon(Icons.local_hospital_rounded, color: AppColors.error, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('DESTINATION HUB', style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
                          Text('Apollo Pharmacy, Anna Nagar Central', style: AppTextStyles.titleSmall),
                        ],
                      ),
                    ),
                    Text('15.8 km total', style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.onDecline,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    side: const BorderSide(color: AppColors.border),
                  ),
                  child: const Text('Decline'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: widget.onAccept,
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_rounded),
                      SizedBox(width: 8),
                      Text('ACCEPT MISSION'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
