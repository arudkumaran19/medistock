import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:signalr_core/signalr_core.dart';
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
  final _taskAssignedController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get onTransferStatusChanged => _statusChangeController.stream;
  Stream<Map<String, dynamic>> get onTransferLocationUpdated => _locationUpdateController.stream;
  Stream<Map<String, dynamic>> get onNotificationCreated => _notificationController.stream;
  Stream<Map<String, dynamic>> get onTaskAssigned => _taskAssignedController.stream;

  bool get isConnected => _hubConnection?.state == HubConnectionState.connected;

  Future<void> connect() async {
    if (isConnected) return;

    final token = await _storage.getToken();
    final hubUrl = AppConfig.signalRHubUrl;

    _hubConnection = HubConnectionBuilder()
        .withUrl(
          hubUrl,
          HttpConnectionOptions(
            accessTokenFactory: () async => token ?? '',
            logging: (level, message) {
              if (kDebugMode) {
                debugPrint('📡 [SignalR] $message');
              }
            },
          ),
        )
        .withAutomaticReconnect()
        .build();

    _hubConnection?.on('TransferStatusChanged', _handleStatusChanged);
    _hubConnection?.on('TransferLocationUpdated', _handleLocationUpdated);
    _hubConnection?.on('NotificationCreated', _handleNotificationCreated);
    _hubConnection?.on('TaskAssigned', _handleTaskAssigned);

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

  void _handleTaskAssigned(List<Object?>? args) {
    if (args != null && args.isNotEmpty && args[0] is Map) {
      _taskAssignedController.add(Map<String, dynamic>.from(args[0] as Map));
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

  Future<void> joinOfficerGroup() async {
    if (isConnected) {
      await _hubConnection?.invoke('JoinOfficerGroup');
    }
  }

  Future<void> leaveOfficerGroup() async {
    if (isConnected) {
      await _hubConnection?.invoke('LeaveOfficerGroup');
    }
  }

  Future<void> sendLocationUpdate(String transferId, double lat, double lng) async {
    if (isConnected) {
      await _hubConnection?.invoke('SendLocationUpdate', args: [transferId, lat, lng]);
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
    _taskAssignedController.close();
  }
}
