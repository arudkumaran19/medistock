// SHARED SCAFFOLDING - NOT owned by the Demand vertical.
// Created by Sathurstiga S. (IT24103156) so the demand routes are reachable. The
// mobile owners replace this with the full router and shell on integration.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/auth/application/auth_providers.dart';
import 'features/auth/presentation/dev_sign_in_screen.dart';
import 'features/demand/presentation/consumption_entry_screen.dart';
import 'features/demand/presentation/demand_history_screen.dart';
import 'features/demand/presentation/forecast_screen.dart';
import 'features/demand/presentation/shortage_alerts_screen.dart';
import 'shared/shared.dart';

class MediStockApp extends StatelessWidget {
  const MediStockApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediStock',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: const _AuthGate(),
      routes: <String, WidgetBuilder>{
        ConsumptionEntryScreen.routeName: (_) => const ConsumptionEntryScreen(),
        ShortageAlertsScreen.routeName: (_) => const ShortageAlertsScreen(),
        ForecastScreen.routeName: (_) => const ForecastScreen(),
        DemandHistoryScreen.routeName: (_) => const DemandHistoryScreen(),
      },
    );
  }
}

/// Shows the sign-in screen until there is a session, then the operational home.
class _AuthGate extends ConsumerWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState state = ref.watch(authControllerProvider);

    if (state.isRestoring) {
      return const Scaffold(body: LoadingView(label: 'Starting…'));
    }

    return state.isSignedIn ? const DemandHomeScreen() : const DevSignInScreen();
  }
}

/// Operational entry point for the Demand & Shortage vertical.
class DemandHomeScreen extends ConsumerWidget {
  const DemandHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState state = ref.watch(authControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('MediStock'),
        actions: <Widget>[
          IconButton(
            key: const Key('sign-out-button'),
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
          ),
        ],
      ),
      body: ListView(
        children: <Widget>[
          if (state.session != null)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text(
                'Signed in as ${state.session!.role.label}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ListTile(
            key: const Key('nav-record-consumption'),
            leading: const Icon(Icons.edit_note_outlined),
            title: const Text('Record consumption'),
            onTap: () =>
                Navigator.of(context).pushNamed(ConsumptionEntryScreen.routeName),
          ),
          ListTile(
            key: const Key('nav-shortage-alerts'),
            leading: const Icon(Icons.warning_amber_outlined),
            title: const Text('Shortage alerts'),
            onTap: () =>
                Navigator.of(context).pushNamed(ShortageAlertsScreen.routeName),
          ),
          ListTile(
            key: const Key('nav-forecast'),
            leading: const Icon(Icons.insights_outlined),
            title: const Text('Demand forecast'),
            onTap: () => Navigator.of(context).pushNamed(ForecastScreen.routeName),
          ),
          ListTile(
            key: const Key('nav-history'),
            leading: const Icon(Icons.history),
            title: const Text('Consumption history'),
            onTap: () =>
                Navigator.of(context).pushNamed(DemandHistoryScreen.routeName),
          ),
        ],
      ),
    );
  }
}
