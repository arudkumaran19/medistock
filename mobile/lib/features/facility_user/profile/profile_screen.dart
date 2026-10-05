import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../auth/presentation/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Facility & Account Profile'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            // User Avatar Card
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
                    backgroundColor: AppColors.primarySurface,
                    child: Text(
                      user?.name.substring(0, 1) ?? 'K',
                      style: AppTextStyles.displayMedium.copyWith(color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(user?.name ?? 'Dr. Kavitha Raman', style: AppTextStyles.titleLarge),
                  const SizedBox(height: 2),
                  Text(user?.email ?? 'kavitha.raman@apollo.example.com', style: AppTextStyles.bodyMedium),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'ROLE: ${user?.role.toUpperCase() ?? "FACILITY_USER"}',
                      style: AppTextStyles.badge.copyWith(color: AppColors.primaryDark),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Facility Details Card
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
                  Text('ASSIGNED FACILITY', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
                  const SizedBox(height: 10),
                  _DetailRow(icon: Icons.local_hospital_rounded, title: 'Facility Name', value: user?.facilityName ?? 'Apollo Pharmacy, Anna Nagar Hub'),
                  const Divider(height: 20),
                  const _DetailRow(icon: Icons.pin_drop_rounded, title: 'Location', value: '2nd Avenue, Block AB, Anna Nagar, Chennai - 600040'),
                  const Divider(height: 20),
                  const _DetailRow(icon: Icons.verified_user_rounded, title: 'District Grid ID', value: 'EXP-CH-408 (Tier 1 Medical Hub)'),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Language & App Settings
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.language_rounded, color: AppColors.primary),
                    title: Text('App Language', style: AppTextStyles.titleSmall),
                    trailing: const Text('English (Tamil available)'),
                    onTap: () {},
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.security_rounded, color: AppColors.primary),
                    title: Text('Security & Encryption', style: AppTextStyles.titleSmall),
                    subtitle: const Text('TLS 1.3 Telemetry Active'),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 28),

            // Logout Button
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
              label: const Text('Sign Out of Account'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;

  const _DetailRow({required this.icon, required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTextStyles.bodySmall),
              Text(value, style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            ],
          ),
        ),
      ],
    );
  }
}
