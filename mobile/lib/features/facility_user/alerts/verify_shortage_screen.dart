import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../requests/new_request_wizard.dart';

class VerifyShortageScreen extends StatefulWidget {
  final Map<String, dynamic> shortageAlert;

  const VerifyShortageScreen({
    super.key,
    required this.shortageAlert,
  });

  @override
  State<VerifyShortageScreen> createState() => _VerifyShortageScreenState();
}

class _VerifyShortageScreenState extends State<VerifyShortageScreen> {
  final ApiClient _apiClient = ApiClient();
  bool _isLoading = false;

  Future<void> _confirmShortage() async {
    setState(() => _isLoading = true);
    final alertId = widget.shortageAlert['id']?.toString() ?? '';
    if (alertId.isNotEmpty) {
      try {
        await _apiClient.post('/api/shortages/$alertId/acknowledge', body: {});
      } catch (_) {}
    }
    setState(() => _isLoading = false);

    if (!mounted) return;

    final medicineName = widget.shortageAlert['medicineName']?.toString() ?? 'Amoxicillin + Clavulanic Acid 625mg';
    final leadTime = widget.shortageAlert['leadTimeDays'] is num ? (widget.shortageAlert['leadTimeDays'] as num).toInt() : 10;
    final daysRemaining = widget.shortageAlert['daysRemaining'] is num ? (widget.shortageAlert['daysRemaining'] as num).toInt() : 2;
    final avgConsumption = widget.shortageAlert['averageDailyConsumption'] is num ? (widget.shortageAlert['averageDailyConsumption'] as num).toDouble() : 20.0;

    int calcQty = ((leadTime - daysRemaining) * avgConsumption).round();
    if (calcQty <= 0) calcQty = 100;

    final riskLevel = widget.shortageAlert['riskLevel']?.toString().toUpperCase() ?? 'HIGH';
    final urgency = riskLevel == 'HIGH' ? 'Critical' : 'Urgent';

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => NewRequestWizard(
          prefillMedicineName: medicineName,
          prefillQuantity: calcQty,
          prefillUrgency: urgency,
          prefillNotes: 'Auto-raised from shortage alert #alert-${alertId.substring(0, alertId.length > 8 ? 8 : alertId.length)}',
          sourceShortageAlertId: alertId,
        ),
      ),
    );
  }

  Future<void> _dismissShortage() async {
    setState(() => _isLoading = true);
    final alertId = widget.shortageAlert['id']?.toString() ?? '';
    if (alertId.isNotEmpty) {
      try {
        await _apiClient.post('/api/shortages/$alertId/resolve', body: {});
      } catch (_) {}
    }
    setState(() => _isLoading = false);

    if (mounted) {
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final alert = widget.shortageAlert;
    final medicineName = alert['medicineName']?.toString() ?? 'Amoxicillin + Clavulanic Acid 625mg';
    final currentStock = alert['currentStock']?.toString() ?? '12';
    final daysRemaining = alert['daysRemaining']?.toString() ?? '2';
    final leadTimeDays = alert['leadTimeDays']?.toString() ?? '10';
    final avgDaily = alert['averageDailyConsumption']?.toString() ?? '20';
    final riskLevel = alert['riskLevel']?.toString().toUpperCase() ?? 'HIGH';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Verify Shortage Alert'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Risk Level Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: riskLevel == 'HIGH' ? AppColors.errorLight : AppColors.warningLight,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: riskLevel == 'HIGH' ? AppColors.error : AppColors.warning,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      riskLevel == 'HIGH' ? Icons.warning_amber_rounded : Icons.info_outline_rounded,
                      color: riskLevel == 'HIGH' ? AppColors.error : AppColors.warning,
                      size: 32,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$riskLevel RISK SHORTAGE DETECTED',
                            style: AppTextStyles.badge.copyWith(
                              color: riskLevel == 'HIGH' ? AppColors.error : AppColors.warning,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Stock remaining will not last through supplier lead time.',
                            style: AppTextStyles.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              Text('Medicine Details', style: AppTextStyles.titleLarge),
              const SizedBox(height: 12),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    _DetailRow(label: 'Medicine', value: medicineName),
                    const Divider(height: 20),
                    _DetailRow(label: 'Current Stock', value: '$currentStock units'),
                    const Divider(height: 20),
                    _DetailRow(label: 'Days Remaining', value: '$daysRemaining days'),
                    const Divider(height: 20),
                    _DetailRow(label: 'Supplier Lead Time', value: '$leadTimeDays days'),
                    const Divider(height: 20),
                    _DetailRow(label: 'Avg. Daily Consumption', value: '$avgDaily units/day'),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              Text('Verification Action', style: AppTextStyles.labelLarge),
              const SizedBox(height: 12),

              ElevatedButton(
                onPressed: _isLoading ? null : _confirmShortage,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  minimumSize: const Size(double.infinity, 48),
                ),
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline_rounded),
                          SizedBox(width: 8),
                          Text('Confirm Shortage & Create Demand Request'),
                        ],
                      ),
              ),

              const SizedBox(height: 12),

              OutlinedButton(
                onPressed: _isLoading ? null : _dismissShortage,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.close_rounded, color: AppColors.textMuted),
                    SizedBox(width: 8),
                    Text('Dismiss as False Positive'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textMuted)),
        Text(value, style: AppTextStyles.titleSmall),
      ],
    );
  }
}
