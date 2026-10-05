import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:signalr_netcore/signalr_netcore.dart';
import '../config/app_config.dart';
import '../storage/secure_storage.dart';

class SignalRClient {
  static final SignalRClient _instance = SignalRClient._internal();
  factory SignalRClient() => _instance;
  SignalRClient._internal();

  HubConnection? _hubConnection;
  final SecureStorageService _storage = SecureStorageService();

  final _statusChangeController = StreamController<Map<String, dynamic>>.broadcast();
  final _locationUpdateController = StreamController<Map<String, dynamic>>.broadcast();
  final _notificationController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get onTransferStatusChanged => _statusChangeController.stream;
  Stream<Map<String, dynamic>> get onTransferLocationUpdated => _locationUpdateController.stream;
  Stream<Map<String, dynamic>> get onNotificationCreated => _notificationController.stream;

  bool get isConnected => _hubConnection?.state == HubConnectionState.Connected;

  Future<void> connect() async {
    if (isConnected) return;

    final token = await _storage.getToken();
    final hubUrl = AppConfig.signalRHubUrl;

    final httpOptions = HttpConnectionOptions(
      accessTokenFactory: () async => token ?? '',
      logging: (level, message) {
        if (kDebugMode) {
          debugPrint('📡 [SignalR] $message');
        }
      },
    );

    _hubConnection = HubConnectionBuilder()
        .withUrl(hubUrl, options: httpOptions)
        .withAutomaticReconnect()
        .build();

    _hubConnection?.on('TransferStatusChanged', _handleStatusChanged);
    _hubConnection?.on('TransferLocationUpdated', _handleLocationUpdated);
    _hubConnection?.on('NotificationCreated', _handleNotificationCreated);

    try {
      await _hubConnection?.start();
      if (kDebugMode) {
        debugPrint('✅ [SignalR] Connected successfully to $hubUrl');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ [SignalR] Connection failed: $e');
      }
    }
  }

  void _handleStatusChanged(List<Object?>? args) {
    if (args != null && args.isNotEmpty && args[0] is Map) {
      _statusChangeController.add(Map<String, dynamic>.from(args[0] as Map));
    }
  }

  void _handleLocationUpdated(List<Object?>? args) {
    if (args != null && args.isNotEmpty && args[0] is Map) {
      _locationUpdateController.add(Map<String, dynamic>.from(args[0] as Map));
    }
  }

  void _handleNotificationCreated(List<Object?>? args) {
    if (args != null && args.isNotEmpty && args[0] is Map) {
      _notificationController.add(Map<String, dynamic>.from(args[0] as Map));
    }
  }

  Future<void> joinTransferGroup(String transferId) async {
    if (isConnected) {
      await _hubConnection?.invoke('JoinTransferGroup', args: [transferId]);
    }
  }

  Future<void> leaveTransferGroup(String transferId) async {
    if (isConnected) {
      await _hubConnection?.invoke('LeaveTransferGroup', args: [transferId]);
    }
  }

  Future<void> disconnect() async {
    if (_hubConnection != null) {
      await _hubConnection?.stop();
      _hubConnection = null;
    }
  }

  void dispose() {
    disconnect();
    _statusChangeController.close();
    _locationUpdateController.close();
    _notificationController.close();
  }
}
