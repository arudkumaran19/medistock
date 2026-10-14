import 'package:flutter/foundation.dart';

class AppConfig {
  static const String appName = 'MediStock AI';
  static const String appVersion = '1.0.0';
  static const String env = String.fromEnvironment('ENV', defaultValue: 'dev');

  static String get apiBaseUrl {
    const envUrl = String.fromEnvironment('API_URL');
    if (envUrl.isNotEmpty) return envUrl;

    switch (env) {
      case 'prod':
        return 'https://api.medistock.ai';
      case 'staging':
        return 'https://staging-api.medistock.ai';
      default:
        // Android emulator uses 10.0.2.2 instead of localhost
        if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
          return 'http://10.0.2.2:5050';
        }
        return 'http://localhost:5050';
    }
  }

  static String get signalRHubUrl {
    return '$apiBaseUrl/hubs/transfers';
  }

  static const int connectTimeoutMs = 15000;
  static const int receiveTimeoutMs = 15000;
}
