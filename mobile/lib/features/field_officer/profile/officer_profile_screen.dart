import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/storage/secure_storage.dart';
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
                      user?.name.isNotEmpty == true
                          ? user!.name.substring(0, 1).toUpperCase()
                          : 'O',
                      style: AppTextStyles.displayMedium
                          .copyWith(color: AppColors.secondary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(user?.name ?? 'Logistics Officer',
                      style: AppTextStyles.titleLarge),
                  const SizedBox(height: 2),
                  Text(
                      user?.email.isNotEmpty == true
                          ? user!.email
                          : 'Not available',
                      style: AppTextStyles.bodyMedium),
                  const SizedBox(height: 10),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.secondaryLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'ROLE: ${user?.role.isNotEmpty == true ? user!.role.toUpperCase() : "Not available"}',
                      style: AppTextStyles.badge
                          .copyWith(color: AppColors.secondary),
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
                  Text('ASSIGNED FACILITY',
                      style: AppTextStyles.badge
                          .copyWith(color: AppColors.textSecondary)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.local_hospital_rounded,
                          size: 20, color: AppColors.secondary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          user?.facilities.isNotEmpty == true
                              ? user!.facilities
                                  .map((f) => f['name'] ?? '')
                                  .where((n) => n.isNotEmpty)
                                  .join(', ')
                              : (user?.facilityName?.isNotEmpty == true
                                  ? user!.facilityName!
                                  : 'Not available'),
                          style: AppTextStyles.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Mode Switcher Tile
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: ListTile(
                leading: const Icon(Icons.swap_horiz_rounded,
                    color: AppColors.primary),
                title: Text('Switch to Facility User View',
                    style: AppTextStyles.titleSmall),
                subtitle: const Text(
                    'Access facility inventory, requisitions, and shortage alerts'),
                trailing: const Icon(Icons.chevron_right_rounded,
                    color: AppColors.textMuted),
                onTap: () async {
                  await SecureStorageService().saveSelectedRole('FACILITYUSER');
                  ref
                      .read(authControllerProvider.notifier)
                      .selectRole('FACILITYUSER');
                  if (context.mounted) {
                    context.go('/user/dashboard');
                  }
                },
              ),
            ),

            const SizedBox(height: 24),

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
