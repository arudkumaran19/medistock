import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/shared.dart';
import '../application/demand_providers.dart';
import '../domain/demand_models.dart';

/// Read-only view of the demand forecasts for the officer's facility.
/// Sathurstiga S. (IT24103156).
///
/// Generating a forecast is a management action and lives in React. The field app
/// looks up the current outlook.
class ForecastScreen extends ConsumerWidget {
  const ForecastScreen({super.key});

  static const String routeName = '/demand/forecasts';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<PagedResponse<DemandForecast>> forecasts = ref.watch(forecastsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Demand forecast')),
      body: forecasts.when(
        loading: () => const LoadingView(label: 'Loading forecasts…'),
        error: (Object error, StackTrace _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(forecastsProvider),
        ),
        data: (PagedResponse<DemandForecast> page) {
          if (page.isEmpty) {
            return const EmptyView(
              message: 'No forecast has been generated for this facility yet.',
              icon: Icons.insights_outlined,
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(forecastsProvider),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              itemCount: page.items.length,
              itemBuilder: (BuildContext context, int index) {
                return _ForecastCard(forecast: page.items[index]);
              },
            ),
          );
        },
      ),
    );
  }
}

class _ForecastCard extends StatelessWidget {
  const _ForecastCard({required this.forecast});

  final DemandForecast forecast;

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
                Text(
                  forecast.methodLabel,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Text(
                  DateFormat('yyyy-MM-dd').format(forecast.generatedAt),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            MetricRow(
              label: 'Average per day',
              value: forecast.averageDailyConsumption.toStringAsFixed(1),
            ),
            MetricRow(
              label: 'Predicted demand',
              value: forecast.predictedDemand.toStringAsFixed(0),
            ),
            MetricRow(label: 'Horizon', value: '${forecast.horizonDays} days'),
            MetricRow(label: 'History window', value: '${forecast.windowDays} days'),
            MetricRow(
              label: 'Confidence',
              value: '${(forecast.confidenceScore * 100).round()}%',
            ),
            MetricRow(label: 'Lead time', value: '${forecast.leadTimeDays} days'),
          ],
        ),
      ),
    );
  }
}
