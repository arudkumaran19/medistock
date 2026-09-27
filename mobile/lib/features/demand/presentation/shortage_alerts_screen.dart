import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/shared.dart';
import '../application/demand_providers.dart';
import '../domain/demand_models.dart';

/// Shortage alerts for the officer's facility.
/// Sathurstiga S. (IT24103156).
///
/// Flutter notifies; it does not approve. Approving a response to a shortage is a
/// management action and lives in React.
class ShortageAlertsScreen extends ConsumerStatefulWidget {
  const ShortageAlertsScreen({super.key});

  static const String routeName = '/demand/shortages';

  @override
  ConsumerState<ShortageAlertsScreen> createState() => _ShortageAlertsScreenState();
}

class _ShortageAlertsScreenState extends ConsumerState<ShortageAlertsScreen> {
  String? _riskFilter;

  @override
  Widget build(BuildContext context) {
    final AsyncValue<PagedResponse<ShortageAlert>> alerts =
        ref.watch(shortageAlertsProvider(_riskFilter));
    final DemandActionState action = ref.watch(demandActionsProvider);

    // Surface a failed action without replacing the list that is already on screen.
    ref.listen<DemandActionState>(demandActionsProvider, (_, DemandActionState next) {
      if (next.errorMessage != null) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(next.errorMessage!)));
        ref.read(demandActionsProvider.notifier).clearError();
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Shortage alerts')),
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: SegmentedButton<String?>(
              key: const Key('risk-filter'),
              segments: const <ButtonSegment<String?>>[
                ButtonSegment<String?>(value: null, label: Text('All')),
                ButtonSegment<String?>(value: 'HIGH', label: Text('High')),
                ButtonSegment<String?>(value: 'MEDIUM', label: Text('Medium')),
              ],
              selected: <String?>{_riskFilter},
              onSelectionChanged: (Set<String?> selection) {
                setState(() => _riskFilter = selection.first);
              },
            ),
          ),
          Expanded(
            child: alerts.when(
              loading: () => const LoadingView(label: 'Loading shortage alerts…'),
              error: (Object error, StackTrace _) => ErrorView(
                message: error.toString(),
                onRetry: () => ref.invalidate(shortageAlertsProvider(_riskFilter)),
              ),
              data: (PagedResponse<ShortageAlert> pageOfAlerts) {
                if (pageOfAlerts.isEmpty) {
                  return const EmptyView(
                    message: 'No shortage alerts for this facility.',
                    icon: Icons.check_circle_outline,
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(shortageAlertsProvider(_riskFilter)),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    itemCount: pageOfAlerts.items.length,
                    itemBuilder: (BuildContext context, int index) {
                      return _ShortageAlertCard(
                        alert: pageOfAlerts.items[index],
                        busy: action.isBusy,
                        onAcknowledge: () => ref
                            .read(demandActionsProvider.notifier)
                            .acknowledgeShortage(pageOfAlerts.items[index].id),
                        onResolve: () => ref
                            .read(demandActionsProvider.notifier)
                            .resolveShortage(pageOfAlerts.items[index].id),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ShortageAlertCard extends StatelessWidget {
  const _ShortageAlertCard({
    required this.alert,
    required this.busy,
    required this.onAcknowledge,
    required this.onResolve,
  });

  final ShortageAlert alert;
  final bool busy;
  final VoidCallback onAcknowledge;
  final VoidCallback onResolve;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    RiskBadge(riskLevel: alert.riskLevel),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      alert.status,
                      key: const Key('alert-status'),
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ],
                ),
                Text(
                  DateFormat('yyyy-MM-dd').format(alert.generatedAt),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            MetricRow(label: 'Stock on hand', value: alert.currentStock.toStringAsFixed(0)),
            MetricRow(
              label: 'Average per day',
              value: alert.averageDailyConsumption.toStringAsFixed(0),
            ),
            MetricRow(label: 'Days of cover', value: alert.coverLabel),
            MetricRow(label: 'Lead time', value: '${alert.leadTimeDays} days'),
            if (alert.projectedStockoutDate != null)
              MetricRow(
                label: 'Projected stockout',
                value: DateFormat('yyyy-MM-dd').format(alert.projectedStockoutDate!),
              ),
            if (alert.requiresTransfer) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Stock will run out before replenishment arrives. '
                'A manager reviews the response.',
                key: const Key('requires-transfer-note'),
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppTheme.riskHigh),
              ),
            ],

            // A field officer can acknowledge that they have seen an alert, and mark
            // one resolved once stock has arrived. Raising or deleting alerts is a
            // management action and stays in the React console.
            if (alert.status != 'RESOLVED') ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: <Widget>[
                  if (alert.status == 'OPEN')
                    TextButton(
                      key: const Key('acknowledge-button'),
                      onPressed: busy ? null : onAcknowledge,
                      child: const Text('Acknowledge'),
                    ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton.tonal(
                    key: const Key('resolve-button'),
                    onPressed: busy ? null : onResolve,
                    child: const Text('Resolve'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
