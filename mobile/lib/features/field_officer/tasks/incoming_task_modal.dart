import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

class IncomingTaskModal extends StatefulWidget {
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final Map<String, dynamic>? taskData;

  const IncomingTaskModal({
    super.key,
    required this.onAccept,
    required this.onDecline,
    this.taskData,
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
    final data = widget.taskData;
    final transferNumber = data?['transferNumber']?.toString() ?? data?['transferId']?.toString() ?? '#TR-20261005';
    
    // Extract Pickup Info
    final pickupMap = data?['pickupLocation'] as Map<String, dynamic>?;
    final pickupName = pickupMap?['name']?.toString() ?? data?['sourceFacilityName']?.toString() ?? 'National Hospital of Sri Lanka (Colombo)';
    final pickupDistance = pickupMap?['distanceKm']?.toString() ?? '3.2';

    // Extract Delivery Info
    final deliveryMap = data?['deliveryLocation'] as Map<String, dynamic>?;
    final deliveryName = deliveryMap?['name']?.toString() ?? data?['destinationFacilityName']?.toString() ?? 'Teaching Hospital Karapitiya (Galle)';
    
    // Extract Distance & Medicine Info
    final distanceMap = data?['distance'] as Map<String, dynamic>?;
    final totalDistanceKm = distanceMap?['km']?.toString() ?? data?['estimatedDistanceKm']?.toString() ?? '119.5';
    
    final itemsList = data?['medicineItems'] as List<dynamic>?;
    final firstItem = itemsList?.isNotEmpty == true ? itemsList!.first as Map<String, dynamic>? : null;
    final medicineTitle = firstItem?['medicineName']?.toString() ?? 'Amoxicillin 500mg';

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
                    Text('DISPATCH ALERT $transferNumber', style: AppTextStyles.badge.copyWith(color: AppColors.secondary)),
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

          Text(medicineTitle, style: AppTextStyles.displayMedium.copyWith(fontSize: 20)),
          Text('High Priority Requisition • Urgent Delivery Mission', style: AppTextStyles.bodyMedium),

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
                          Text(pickupName, style: AppTextStyles.titleSmall),
                        ],
                      ),
                    ),
                    Text('$pickupDistance km', style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
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
                          Text(deliveryName, style: AppTextStyles.titleSmall),
                        ],
                      ),
                    ),
                    Text('$totalDistanceKm km total', style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
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
