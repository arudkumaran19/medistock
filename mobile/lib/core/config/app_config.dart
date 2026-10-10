import 'package:flutter/foundation.dart';

class AppConfig {
  static const String appName = 'MediStock AI';
  static const String appVersion = '1.0.0';

  static String get apiBaseUrl {
    const envUrl = String.fromEnvironment('API_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:5050';
    }
    return 'http://localhost:5050';
  }

  static String get signalRHubUrl {
    return '$apiBaseUrl/hubs/transfers';
  }

  static const int connectTimeoutMs = 15000;
  static const int receiveTimeoutMs = 15000;
}
