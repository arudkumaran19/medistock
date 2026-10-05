import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/progress_stepper.dart';
import '../../../shared/widgets/status_chip.dart';
import '../../auth/presentation/auth_controller.dart';

class UserHomeScreen extends ConsumerStatefulWidget {
  const UserHomeScreen({super.key});

  @override
  ConsumerState<UserHomeScreen> createState() => _UserHomeScreenState();
}

class _UserHomeScreenState extends ConsumerState<UserHomeScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.local_pharmacy_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('MediStock AI', style: AppTextStyles.titleMedium),
                Text('Chennai Health Grid', style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () => context.push('/user/alerts'),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.primarySurface,
              child: Text(
                user?.name.substring(0, 1) ?? 'K',
                style: AppTextStyles.badge.copyWith(color: AppColors.primaryDark),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Sync pill
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primarySurface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                      Text('Grid Connected • AI Sync Active (2m ago)', style: AppTextStyles.bodySmall.copyWith(color: AppColors.primaryDark, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                const Spacer(),
                Text('ID: EXP-CH-408', style: AppTextStyles.bodySmall),
              ],
            ),

            const SizedBox(height: 14),

            // User Greeting
            Text(
              'Good morning, ${user?.name ?? "Dr. Kavitha Raman"}',
              style: AppTextStyles.displayMedium.copyWith(fontSize: 22),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 14, color: AppColors.primary),
                const SizedBox(width: 4),
                Text(
                  '${user?.facilityName ?? "Apollo Pharmacy, Anna Nagar Hub"} • Tier 1 Facility',
                  style: AppTextStyles.bodyMedium,
                ),
              ],
            ),

            const SizedBox(height: 20),

            // OPERATIONAL VITALS
            Text('OPERATIONAL VITALS', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            Row(
              children: [
                // Total Stock Items Box
                Expanded(
                  child: Container(
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
                            Text('Total Stock Items', style: AppTextStyles.bodySmall),
                            const Icon(Icons.inventory_2_outlined, size: 16, color: AppColors.primary),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text('14,820', style: AppTextStyles.displayLarge.copyWith(fontSize: 26)),
                        const SizedBox(height: 4),
                        Text('+5.2% vs previous wk', style: AppTextStyles.bodySmall.copyWith(color: AppColors.success, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Low Stock Alerts Box
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.errorLight,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.error.withOpacity(0.3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Low Stock Alerts', style: AppTextStyles.bodySmall.copyWith(color: AppColors.error)),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Text('3', style: AppTextStyles.displayLarge.copyWith(fontSize: 26, color: AppColors.error)),
                            const SizedBox(width: 6),
                            Text('CRITICAL ITEMS', style: AppTextStyles.badge.copyWith(color: AppColors.error)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('Amoxicillin, Ceftriaxone...', style: AppTextStyles.bodySmall.copyWith(color: AppColors.error, fontSize: 11), overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // AI FORECAST CARD
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB), // Warm yellow tint
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFFCD34D)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.smart_toy_rounded, size: 12, color: Colors.white),
                            const SizedBox(width: 4),
                            Text('AI FORECAST', style: AppTextStyles.badge.copyWith(color: Colors.white)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('Critical Lead Time', style: AppTextStyles.badge.copyWith(color: AppColors.warning)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Predicted stockout in 36 hrs for Meropenem 1g IV due to seasonal dengue spike. 2 surplus facilities nearby found in Guindy (4.8 km).',
                    style: AppTextStyles.bodyMedium.copyWith(color: const Color(0xFF78350F)),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: () => context.push('/user/requests/new'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryDark,
                      minimumSize: const Size(double.infinity, 44),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Auto-Draft Requisition', style: AppTextStyles.titleSmall.copyWith(color: Colors.white)),
                        const SizedBox(width: 6),
                        const Icon(Icons.arrow_forward_rounded, size: 16),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // QUICK OPERATIONS 2x2 GRID
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('QUICK OPERATIONS', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
                Text('1-Tap Portals', style: AppTextStyles.bodySmall),
              ],
            ),
            const SizedBox(height: 12),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.45,
              children: [
                _QuickOpCard(
                  icon: Icons.add_circle_outline_rounded,
                  iconBg: AppColors.primarySurface,
                  iconColor: AppColors.primary,
                  title: 'New Request',
                  subtitle: 'Request stock from nearby hubs',
                  onTap: () => context.push('/user/requests/new'),
                ),
                _QuickOpCard(
                  icon: Icons.inventory_rounded,
                  iconBg: AppColors.secondaryLight,
                  iconColor: AppColors.secondary,
                  title: 'My Inventory',
                  subtitle: 'Real-time batch & expiry audit',
                  onTap: () => context.push('/user/inventory'),
                ),
                _QuickOpCard(
                  icon: Icons.alt_route_rounded,
                  iconBg: AppColors.infoLight,
                  iconColor: AppColors.info,
                  title: 'Track Delivery',
                  subtitle: 'Live GPS vehicle telemetry',
                  onTap: () => context.push('/user/requests'),
                ),
                _QuickOpCard(
                  icon: Icons.auto_graph_rounded,
                  iconBg: AppColors.warningLight,
                  iconColor: AppColors.warning,
                  title: 'Forecast AI',
                  subtitle: 'Predictive 14-day stockout AI',
                  onTap: () => context.push('/user/alerts'),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // LIVE TRANSIT CORRIDOR
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.ac_unit_rounded, size: 18, color: AppColors.info),
                          const SizedBox(width: 8),
                          Text('Live Transit Corridor', style: AppTextStyles.titleMedium),
                        ],
                      ),
                      Text('Active: #REQ-2024-8842', style: AppTextStyles.badge.copyWith(color: AppColors.info)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const ProgressStepper(currentStep: 3),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.thermostat_rounded, size: 14, color: AppColors.info),
                          const SizedBox(width: 4),
                          Text('Cold Chain: +3.8°C (Optimal)', style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.w600)),
                        ],
                      ),
                      Row(
                        children: [
                          const Icon(Icons.navigation_outlined, size: 14, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text('Poonamallee Rd (3.2 km)', style: AppTextStyles.bodySmall),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // RECENT REQUESTS
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('RECENT REQUESTS', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
                TextButton(
                  onPressed: () => context.push('/user/requests'),
                  child: Text('View All (18)', style: AppTextStyles.bodySmall.copyWith(color: AppColors.primary, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 8),

            _RecentRequestCard(
              id: '#REQ-2024-8842',
              medicineName: 'Cefixime 200mg',
              details: '120 strips • Batch #CF-909',
              route: 'Rajiv Gandhi Govt Hospital ➔ Apollo Anna Nagar',
              status: 'INTRANSIT',
              onTap: () => context.push('/user/requests/req-8842'),
            ),
            const SizedBox(height: 10),
            _RecentRequestCard(
              id: '#REQ-2024-8839',
              medicineName: 'Human Albumin 20%',
              details: '15 vials (100ml) • Cold storage (2°C-8°C)',
              route: 'Kilpauk Medical Depot ➔ Apollo Anna Nagar',
              status: 'APPROVED',
              onTap: () => context.push('/user/requests/req-8839'),
            ),
            const SizedBox(height: 10),
            _RecentRequestCard(
              id: '#REQ-2024-8810',
              medicineName: 'Paracetamol 650mg',
              details: '500 strips • Verified via barcode scan',
              route: 'MedPlus Guindy Hub ➔ Apollo Anna Nagar',
              status: 'DELIVERED',
              onTap: () => context.push('/user/requests/req-8810'),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        onTap: (index) {
          setState(() => _currentIndex = index);
          if (index == 1) context.push('/user/inventory');
          if (index == 2) context.push('/user/requests');
          if (index == 3) context.push('/user/alerts');
          if (index == 4) context.push('/user/profile');
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.grid_view_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.inventory_2_rounded), label: 'Inventory'),
          BottomNavigationBarItem(icon: Icon(Icons.swap_horiz_rounded), label: 'Requests'),
          BottomNavigationBarItem(icon: Icon(Icons.warning_amber_rounded), label: 'Alerts'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}

class _QuickOpCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _QuickOpCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 8),
            Text(title, style: AppTextStyles.titleSmall),
            const SizedBox(height: 2),
            Text(subtitle, style: AppTextStyles.bodySmall.copyWith(fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _RecentRequestCard extends StatelessWidget {
  final String id;
  final String medicineName;
  final String details;
  final String route;
  final String status;
  final VoidCallback onTap;

  const _RecentRequestCard({
    required this.id,
    required this.medicineName,
    required this.details,
    required this.route,
    required this.status,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
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
                Text(id, style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
                StatusChip(status: status),
              ],
            ),
            const SizedBox(height: 8),
            Text(medicineName, style: AppTextStyles.titleSmall.copyWith(fontSize: 16)),
            const SizedBox(height: 2),
            Text(details, style: AppTextStyles.bodySmall),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.alt_route_rounded, size: 14, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(child: Text(route, style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
