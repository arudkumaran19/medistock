import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import 'alerts_provider.dart';
import '../requests/new_request_wizard.dart';

class VerifyShortageScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> shortageAlert;
  final Dio? dio;

  const VerifyShortageScreen({
    super.key,
    required this.shortageAlert,
    this.dio,
  });

  @override
  ConsumerState<VerifyShortageScreen> createState() => _VerifyShortageScreenState();
}

class _VerifyShortageScreenState extends ConsumerState<VerifyShortageScreen> {
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

    final medicineId = widget.shortageAlert['medicineId']?.toString();
    final facilityId = widget.shortageAlert['facilityId']?.toString();
    final medicineName = widget.shortageAlert['medicineName']?.toString() ?? 'Amoxicillin 250 mg';
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
          prefillMedicineId: medicineId,
          prefillMedicineName: medicineName,
          prefillDestinationFacilityId: facilityId,
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
        final dio = widget.dio ?? DioClient().dio;
        await dio.post(
          '/api/shortages/$alertId/dismiss',
          data: {'reason': 'Dismissed as false positive'},
        );

        if (!mounted) return;
        ref.read(alertsProvider.notifier).removeAlert(alertId);

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Shortage alert dismissed as false positive.'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
        return;
      } on DioException catch (dioErr) {
        if (!mounted) return;
        final backendMsg = dioErr.response?.data?['error']?['message']?.toString() ??
            dioErr.response?.data?['message']?.toString();

        if (dioErr.response?.statusCode == 403) {
          final displayMsg = backendMsg ?? 'Permission denied: You can only dismiss alerts for your own assigned facility.';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              key: const Key('forbidden-error-snackbar'),
              content: Text(displayMsg),
              backgroundColor: Colors.red,
            ),
          );
        } else if (dioErr.response?.statusCode == 409) {
          final displayMsg = backendMsg ?? 'This alert cannot be dismissed because of a status conflict.';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              key: const Key('conflict-error-snackbar'),
              content: Text(displayMsg),
              backgroundColor: Colors.red,
            ),
          );
        } else {
          final msg = backendMsg ??
              dioErr.message ??
              'Failed to dismiss shortage alert';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error: $msg'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } catch (err) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Unexpected error: $err'),
            backgroundColor: Colors.red,
          ),
        );
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
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
