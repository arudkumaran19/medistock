import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/shared.dart';
import '../application/auth_providers.dart';
import '../domain/session.dart';

/// TEMPORARY DEVELOPMENT SIGN-IN. DELETE ON INTEGRATION.
///
/// Authentication is owned by Vaisnavi L. (IT24102469). Her real sign-in - email and
/// password, Identity users, refresh tokens - replaces this screen entirely.
///
/// This exists so the operational Demand screens, which all require a token, can be
/// opened on a device before Auth lands. The endpoint behind it refuses to run outside
/// the Development environment.
class DevSignInScreen extends ConsumerWidget {
  const DevSignInScreen({super.key});

  static const Map<UserRole, String> _blurbs = <UserRole, String>{
    UserRole.storeOfficer: 'Record consumption, view shortage alerts.',
    UserRole.facilityManager: 'Review forecasts and shortage risk.',
    UserRole.admin: 'Full access across every facility.',
    UserRole.supplierOfficer: 'Suppliers, orders and deliveries.',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState state = ref.watch(authControllerProvider);
    final ThemeData theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const SizedBox(height: AppSpacing.lg),
              Text('MediStock', style: theme.textTheme.headlineMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Field operations',
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: AppSpacing.lg),

              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppTheme.riskMedium.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadius.medium),
                  border: Border.all(
                    color: AppTheme.riskMedium.withValues(alpha: 0.4),
                  ),
                ),
                child: Text(
                  'Development sign-in. Real authentication is not built yet, so choose '
                  'a role to continue. No password is checked.',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: AppTheme.riskMedium),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),
              Text('Continue as', style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),

              for (final UserRole role in UserRole.values)
                Card(
                  child: ListTile(
                    key: Key('role-${role.wireValue}'),
                    title: Text(role.label),
                    subtitle: Text(_blurbs[role] ?? ''),
                    trailing: state.isSigningIn
                        ? null
                        : const Icon(Icons.chevron_right),
                    onTap: state.isSigningIn
                        ? null
                        : () => ref
                            .read(authControllerProvider.notifier)
                            .signIn(role),
                  ),
                ),

              if (state.isSigningIn) ...<Widget>[
                const SizedBox(height: AppSpacing.md),
                const LoadingView(label: 'Signing in…'),
              ],

              if (state.errorMessage != null) ...<Widget>[
                const SizedBox(height: AppSpacing.md),
                ErrorView(
                  key: const Key('sign-in-error'),
                  message: state.errorMessage!,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
