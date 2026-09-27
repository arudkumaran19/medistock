import 'package:flutter/material.dart';

/// Shared MediStock mobile theme.
///
/// SHARED FLUTTER DESIGN SYSTEM - primary owner: Sathurstiga S. (IT24103156).
/// Every Flutter vertical consumes this theme; no vertical defines its own colours.
class AppTheme {
  const AppTheme._();

  /// Seed colour for the operational application.
  static const Color seed = Color(0xFF00696E);

  /// Semantic colour for a medicine at shortage risk.
  static const Color riskHigh = Color(0xFFB3261E);

  /// Semantic colour for a medicine with sufficient cover.
  static const Color riskMedium = Color(0xFF7A5300);

  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final ColorScheme scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        centerTitle: false,
        elevation: 0,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        isDense: true,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
        ),
      ),
      // CardThemeData, not CardTheme: ThemeData.cardTheme takes the data class.
      cardTheme: CardThemeData(
        elevation: 0,
        margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.medium),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),
    );
  }

  /// Colour for a shortage risk level returned by the API.
  static Color riskColour(String riskLevel) {
    return riskLevel.toUpperCase() == 'HIGH' ? riskHigh : riskMedium;
  }
}

/// Shared spacing scale. Screens use these rather than raw numbers.
class AppSpacing {
  const AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
}

/// Shared corner radii.
class AppRadius {
  const AppRadius._();

  static const double small = 6;
  static const double medium = 12;
}
