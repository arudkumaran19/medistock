import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Shared status badge.
///
/// SHARED FLUTTER DESIGN SYSTEM - primary owner: Sathurstiga S. (IT24103156).
class RiskBadge extends StatelessWidget {
  const RiskBadge({super.key, required this.riskLevel});

  final String riskLevel;

  @override
  Widget build(BuildContext context) {
    final Color colour = AppTheme.riskColour(riskLevel);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.small),
        border: Border.all(color: colour.withValues(alpha: 0.4)),
      ),
      child: Text(
        riskLevel.toUpperCase(),
        style: Theme.of(context)
            .textTheme
            .labelSmall
            ?.copyWith(color: colour, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Shared label/value row used across the operational screens.
///
/// SHARED FLUTTER DESIGN SYSTEM - primary owner: Sathurstiga S. (IT24103156).
class MetricRow extends StatelessWidget {
  const MetricRow({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(
            value,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
