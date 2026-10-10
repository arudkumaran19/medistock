import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import 'auth_controller.dart';

class RoleSelectionScreen extends ConsumerWidget {
  const RoleSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              // App Logo & Header
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.primary, AppColors.secondary],
                        ),
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.25),
                            blurRadius: 16,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.local_pharmacy_rounded, color: Colors.white, size: 36),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primarySurface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primaryLight.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.auto_awesome, size: 12, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            'AI-POWERED REDISTRIBUTION SYSTEM',
                            style: AppTextStyles.badge.copyWith(color: AppColors.primaryDark),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Smart Medicine, Right\nPlace, Right Time',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.displayMedium.copyWith(height: 1.15),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Welcome to MediStock AI — Choose your operational role to enter dispatch network.',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // District Pulse Chip
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.success,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        'Serving Greater Chennai Healthcare District (48 active hubs)',
                        style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // CARD 1: USER / FACILITY PORTAL
              _RoleCard(
                badgeLabel: 'USER / FACILITY',
                badgeColor: AppColors.primary,
                chipLabel: 'Active Hub',
                title: 'Facility & Clinic Portal',
                subtitle: 'Apollo Pharmacy, General Hospitals & Community Health Clinics',
                features: const [
                  'Request emergency medicine reallocations',
                  'Real-time stock shortage AI forecasting',
                  'Live GPS delivery & cold-chain tracking',
                ],
                buttonText: 'Continue as Facility User',
                buttonColor: AppColors.primary,
                iconData: Icons.local_hospital_rounded,
                onTap: () {
                  ref.read(authControllerProvider.notifier).selectRole('FACILITY_USER');
                  context.push('/login/user');
                },
              ),

              const SizedBox(height: 20),

              // CARD 2: FIELD LOGISTICS OFFICER PORTAL
              _RoleCard(
                badgeLabel: 'FIELD LOGISTICS OFFICER',
                badgeColor: AppColors.secondary,
                chipLabel: 'Cold-Chain',
                title: 'Logistics Field Fleet',
                subtitle: 'Medical dispatch couriers & verified cold-chain drivers',
                features: const [
                  'Real-time dispatch mission alerts & prioritization',
                  'Route telemetry & automated chain-of-custody',
                  'Digital OTP, temperature logs & signature handoff',
                ],
                buttonText: 'Continue as Field Officer',
                buttonColor: AppColors.secondary,
                iconData: Icons.local_shipping_rounded,
                onTap: () {
                  ref.read(authControllerProvider.notifier).selectRole('FIELD_OFFICER');
                  context.push('/login/officer');
                },
              ),

              const SizedBox(height: 24),

              // Live Pulse Footer Stats
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.show_chart_rounded, size: 16, color: AppColors.primary),
                            const SizedBox(width: 6),
                            Text('Network Pulse (Live)', style: AppTextStyles.titleSmall),
                          ],
                        ),
                        Text('99.8% On-Time', style: AppTextStyles.badge.copyWith(color: AppColors.success)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _StatBox(label: 'Active Vans', value: '142'),
                        const SizedBox(width: 8),
                        _StatBox(label: 'Avg Transit', value: '18m'),
                        const SizedBox(width: 8),
                        _StatBox(label: 'Cold Core', value: '3.4°C'),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),
              Center(
                child: Text(
                  'HIPAA & CDSCO Compliant • Real-time Encrypted Telemetry',
                  style: AppTextStyles.bodySmall,
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final String badgeLabel;
  final Color badgeColor;
  final String chipLabel;
  final String title;
  final String subtitle;
  final List<String> features;
  final String buttonText;
  final Color buttonColor;
  final IconData iconData;
  final VoidCallback onTap;

  const _RoleCard({
    required this.badgeLabel,
    required this.badgeColor,
    required this.chipLabel,
    required this.title,
    required this.subtitle,
    required this.features,
    required this.buttonText,
    required this.buttonColor,
    required this.iconData,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(iconData, color: badgeColor, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  badgeLabel,
                  style: AppTextStyles.badge.copyWith(color: badgeColor, fontWeight: FontWeight.bold),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(chipLabel, style: AppTextStyles.bodySmall.copyWith(color: badgeColor, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(title, style: AppTextStyles.titleLarge),
          const SizedBox(height: 4),
          Text(subtitle, style: AppTextStyles.bodyMedium),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceSubtle,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: features
                  .map(
                    (f) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Icon(Icons.check_circle_rounded, size: 16, color: badgeColor),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(f, style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w500)),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: buttonColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(buttonText),
                const SizedBox(width: 8),
                const Icon(Icons.arrow_forward_rounded, size: 18),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label;
  final String value;

  const _StatBox({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceSubtle,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(value, style: AppTextStyles.titleMedium.copyWith(color: AppColors.primaryDark, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(label, style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
          ],
        ),
      ),
    );
  }
}
