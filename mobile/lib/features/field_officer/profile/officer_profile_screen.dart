import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../auth/presentation/auth_controller.dart';

class OfficerProfileScreen extends ConsumerWidget {
  const OfficerProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Officer Fleet Credentials'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: AppColors.secondaryLight,
                    child: Text(
                      user?.name.substring(0, 1) ?? 'R',
                      style: AppTextStyles.displayMedium.copyWith(color: AppColors.secondary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(user?.name ?? 'Rajesh Kumar', style: AppTextStyles.titleLarge),
                  const SizedBox(height: 2),
                  Text('Field Officer ID: EPO-8842 • Certified Cold-Chain Courier', style: AppTextStyles.bodyMedium),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.secondaryLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text('RATING 4.9★ (142 DELIVERIES)', style: AppTextStyles.badge.copyWith(color: AppColors.secondary)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Vehicle Credentials
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('ASSIGNED DISPATCH FLEET', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
                  const SizedBox(height: 10),
                  const _ProfileRow(title: 'Vehicle Number', value: 'TN-09-CB-4491 (Cryo-Van)'),
                  const Divider(height: 20),
                  const _ProfileRow(title: 'Cold Storage Vault', value: 'Cryo-Pod 302 (-20°C to +8°C)'),
                  const Divider(height: 20),
                  const _ProfileRow(title: 'License & Permit', value: 'Tamil Nadu Medical Transport Pass #TN-MED-9921'),
                ],
              ),
            ),

            const SizedBox(height: 28),

            OutlinedButton.icon(
              onPressed: () async {
                await ref.read(authControllerProvider.notifier).logout();
                if (context.mounted) {
                  context.go('/role-selection');
                }
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.error),
              ),
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Sign Out of Dispatch Console'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  final String title;
  final String value;

  const _ProfileRow({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTextStyles.bodySmall),
        Text(value, style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
      ],
    );
  }
}
