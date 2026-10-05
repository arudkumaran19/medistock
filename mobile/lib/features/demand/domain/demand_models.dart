/// Demand & Shortage domain models for the operational application.
/// Sathurstiga S. (IT24103156).
///
/// Mirror the frozen API contract exactly. No calculation happens here - every
/// derived figure is produced by the authoritative backend.
library;

/// A recorded consumption observation.
class ConsumptionRecord {
  const ConsumptionRecord({
    required this.id,
    required this.facilityId,
    required this.medicineId,
    required this.quantityUsed,
    required this.consumptionDate,
    required this.source,
    this.notes,
  });

  final String id;
  final String facilityId;
  final String medicineId;
  final double quantityUsed;
  final DateTime consumptionDate;
  final String source;
  final String? notes;

  factory ConsumptionRecord.fromJson(Map<String, dynamic> json) {
    return ConsumptionRecord(
      id: json['id'] as String,
      facilityId: json['facilityId'] as String,
      medicineId: json['medicineId'] as String,
      quantityUsed: (json['quantityUsed'] as num).toDouble(),
      consumptionDate: DateTime.parse(json['consumptionDate'] as String),
      source: json['source'] as String,
      notes: json['notes'] as String?,
    );
  }
}

/// A stored demand forecast.
class DemandForecast {
  const DemandForecast({
    required this.id,
    required this.facilityId,
    required this.medicineId,
    required this.forecastDate,
    required this.predictedDemand,
    required this.averageDailyConsumption,
    required this.method,
    required this.windowDays,
    required this.horizonDays,
    required this.confidenceScore,
    required this.leadTimeDays,
    required this.generatedAt,
    required this.status,
  });

  final String id;
  final String facilityId;
  final String medicineId;
  final DateTime forecastDate;
  final double predictedDemand;
  final double averageDailyConsumption;
  final String method;
  final int windowDays;
  final int horizonDays;
  final double confidenceScore;
  final int leadTimeDays;
  final DateTime generatedAt;
  final String status;

  factory DemandForecast.fromJson(Map<String, dynamic> json) {
    return DemandForecast(
      id: json['id'] as String,
      facilityId: json['facilityId'] as String,
      medicineId: json['medicineId'] as String,
      forecastDate: DateTime.parse(json['forecastDate'] as String),
      predictedDemand: (json['predictedDemand'] as num).toDouble(),
      averageDailyConsumption: (json['averageDailyConsumption'] as num).toDouble(),
      method: json['method'] as String,
      windowDays: json['windowDays'] as int,
      horizonDays: json['horizonDays'] as int,
      confidenceScore: (json['confidenceScore'] as num).toDouble(),
      leadTimeDays: json['leadTimeDays'] as int,
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      status: json['status'] as String,
    );
  }

  /// Human-readable method name for display.
  String get methodLabel => method.replaceAll('_', ' ').toLowerCase();
}

/// A shortage alert: the end of the demonstration chain.
class ShortageAlert {
  const ShortageAlert({
    required this.id,
    required this.facilityId,
    required this.medicineId,
    required this.currentStock,
    required this.averageDailyConsumption,
    required this.daysRemaining,
    required this.projectedStockoutDate,
    required this.leadTimeDays,
    required this.riskLevel,
    required this.requiresTransfer,
    required this.generatedAt,
    required this.status,
    this.demandForecastId,
  });

  final String id;
  final String facilityId;
  final String medicineId;
  final String? demandForecastId;
  final double currentStock;
  final double averageDailyConsumption;

  /// Null when nothing is being consumed, so no stockout is projected.
  /// This is not the same as zero days, which means stock runs out today.
  final int? daysRemaining;

  final DateTime? projectedStockoutDate;
  final int leadTimeDays;
  final String riskLevel;
  final bool requiresTransfer;
  final DateTime generatedAt;
  final String status;

  factory ShortageAlert.fromJson(Map<String, dynamic> json) {
    final dynamic stockoutDate = json['projectedStockoutDate'];

    return ShortageAlert(
      id: json['id'] as String,
      facilityId: json['facilityId'] as String,
      medicineId: json['medicineId'] as String,
      demandForecastId: json['demandForecastId'] as String?,
      currentStock: (json['currentStock'] as num).toDouble(),
      averageDailyConsumption: (json['averageDailyConsumption'] as num).toDouble(),
      daysRemaining: json['daysRemaining'] as int?,
      projectedStockoutDate:
          stockoutDate == null ? null : DateTime.parse(stockoutDate as String),
      leadTimeDays: json['leadTimeDays'] as int,
      riskLevel: json['riskLevel'] as String,
      requiresTransfer: json['requiresTransfer'] as bool,
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      status: json['status'] as String,
    );
  }

  /// Days of cover in words, distinguishing "no stockout" from "none left".
  String get coverLabel {
    if (daysRemaining == null) {
      return 'No stockout projected';
    }

    return daysRemaining == 1 ? '1 day' : '$daysRemaining days';
  }
}

/// A new consumption entry submitted from the field.
class ConsumptionEntry {
  const ConsumptionEntry({
    required this.facilityId,
    required this.medicineId,
    required this.quantityUsed,
    required this.consumptionDate,
    required this.source,
    this.notes,
  });

  final String facilityId;
  final String medicineId;
  final double quantityUsed;
  final DateTime consumptionDate;
  final String source;
  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'facilityId': facilityId,
        'medicineId': medicineId,
        'quantityUsed': quantityUsed,
        'consumptionDate': consumptionDate.toUtc().toIso8601String(),
        'source': source,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}
