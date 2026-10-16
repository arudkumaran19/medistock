import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AppConstants {
  static const String appTitle = 'MediStock Field Ops';
  static String get apiBaseUrl {
    const envUrl = String.fromEnvironment('API_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:5050';
    }
    return 'http://localhost:5050';
  }

  // Neutral map center (Sri Lanka geographic center) for empty/loading map states
  static const double sriLankaCenterLatitude = 7.8731;
  static const double sriLankaCenterLongitude = 80.7718;
  static const double sriLankaDefaultZoom = 7.0;
}

class AppColors {
  static const Color primary = Color(0xFF10B981);
  static const Color primaryDark = Color(0xFF059669);
  static const Color primaryLight = Color(0xFFD1FAE5);
  static const Color secondary = Color(0xFF06B6D4);
  static const Color accent = Color(0xFF3B82F6);
  static const Color background = Color(0xFF0B1120);
  static const Color surface = Color(0xFF1E293B);
  static const Color surfaceHighlight = Color(0xFF334155);
  static const Color card = Color(0xFF1E293B);
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
  static const Color border = Color(0xFF334155);

  // Status Colors
  static const Color statusDraft = Color(0xFF94A3B8);
  static const Color statusRequested = Color(0xFFF59E0B);
  static const Color statusApproved = Color(0xFF3B82F6);
  static const Color statusReserved = Color(0xFF8B5CF6);
  static const Color statusInTransit = Color(0xFF06B6D4);
  static const Color statusDelivered = Color(0xFF10B981);
  static const Color statusRejected = Color(0xFFF43F5E);
  static const Color statusCancelled = Color(0xFF64748B);

  static Color getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'draft':
        return statusDraft;
      case 'requested':
        return statusRequested;
      case 'approved':
        return statusApproved;
      case 'reserved':
        return statusReserved;
      case 'intransit':
      case 'in transit':
        return statusInTransit;
      case 'delivered':
        return statusDelivered;
      case 'rejected':
        return statusRejected;
      case 'cancelled':
        return statusCancelled;
      default:
        return textSecondary;
    }
  }

  static Color getPriorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'emergency':
        return const Color(0xFFF43F5E);
      case 'urgent':
        return const Color(0xFFF59E0B);
      case 'routine':
      default:
        return const Color(0xFF3B82F6);
    }
  }
}
