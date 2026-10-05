import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:signalr_core/signalr_core.dart';
import '../../../core/constants/app_constants.dart';
import '../models/transfer_models.dart';

/// SignalR Client service for real-time status push and location tracking in Flutter mobile
class TransferSignalRService {
  HubConnection? _hubConnection;
  final String _hubUrl;
  bool _isConnected = false;
  String? _subscribedTransferId;

  final StreamController<Transfer> _statusUpdatesController =
      StreamController<Transfer>.broadcast();
  final StreamController<TransferLocationUpdate> _locationUpdatesController =
      StreamController<TransferLocationUpdate>.broadcast();
  final StreamController<TransferNotificationItem> _notificationController =
      StreamController<TransferNotificationItem>.broadcast();
  final StreamController<bool> _connectionStateController =
      StreamController<bool>.broadcast();

  Stream<Transfer> get onTransferStatusChanged =>
      _statusUpdatesController.stream;
  Stream<TransferLocationUpdate> get onTransferLocationUpdated =>
      _locationUpdatesController.stream;
  Stream<TransferNotificationItem> get onNotificationCreated =>
      _notificationController.stream;
  Stream<bool> get onConnectionStateChanged =>
      _connectionStateController.stream;
  bool get isConnected => _isConnected;

  TransferSignalRService({String? hubUrl})
      : _hubUrl = hubUrl ?? '${AppConstants.apiBaseUrl}/hubs/transfers';

  /// Initialize and connect to the SignalR hub.
  /// Falls back gracefully if backend or socket is unreachable.
  Future<void> initAndConnect({String? transferId}) async {
    _subscribedTransferId = transferId;

    try {
      _hubConnection = HubConnectionBuilder()
          .withUrl(_hubUrl)
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .build();

      _hubConnection!.on('TransferStatusChanged', _handleTransferStatusChanged);
      _hubConnection!.on('TransferLocationUpdated', _handleTransferLocationUpdated);
      _hubConnection!.on('NotificationCreated', _handleNotificationCreated);

      _hubConnection!.onreconnecting((error) {
        _isConnected = false;
        _connectionStateController.add(false);
        debugPrint('SignalR Reconnecting: $error');
      });

      _hubConnection!.onreconnected((connectionId) {
        _isConnected = true;
        _connectionStateController.add(true);
        debugPrint('SignalR Reconnected with ID: $connectionId');
        if (_subscribedTransferId != null) {
          joinTransferGroup(_subscribedTransferId!);
        }
      });

      _hubConnection!.onclose((error) {
        _isConnected = false;
        _connectionStateController.add(false);
        debugPrint('SignalR Closed: $error');
      });

      await _hubConnection!.start();
      _isConnected = true;
      _connectionStateController.add(true);

      if (_subscribedTransferId != null) {
        await joinTransferGroup(_subscribedTransferId!);
      }
    } catch (e) {
      _isConnected = false;
      _connectionStateController.add(false);
      debugPrint('SignalR Connection Failed (fallback to polling): $e');
    }
  }

  void _handleTransferStatusChanged(List<Object?>? arguments) {
    if (arguments == null || arguments.isEmpty) return;
    try {
      final raw = arguments.first;
      if (raw is Map<String, dynamic>) {
        final transfer = Transfer.fromJson(raw);
        _statusUpdatesController.add(transfer);
      } else if (raw is Map) {
        final transfer = Transfer.fromJson(Map<String, dynamic>.from(raw));
        _statusUpdatesController.add(transfer);
      }
    } catch (e) {
      debugPrint('Error parsing TransferStatusChanged payload: $e');
    }
  }

  void _handleTransferLocationUpdated(List<Object?>? arguments) {
    if (arguments == null || arguments.isEmpty) return;
    try {
      final raw = arguments.first;
      if (raw is Map<String, dynamic>) {
        final update = TransferLocationUpdate.fromJson(raw);
        _locationUpdatesController.add(update);
      } else if (raw is Map) {
        final update =
            TransferLocationUpdate.fromJson(Map<String, dynamic>.from(raw));
        _locationUpdatesController.add(update);
      }
    } catch (e) {
      debugPrint('Error parsing TransferLocationUpdated payload: $e');
    }
  }

  void _handleNotificationCreated(List<Object?>? arguments) {
    if (arguments == null || arguments.isEmpty) return;
    try {
      final raw = arguments.first;
      if (raw is Map<String, dynamic>) {
        final notif = TransferNotificationItem.fromJson(raw);
        _notificationController.add(notif);
      } else if (raw is Map) {
        final notif =
            TransferNotificationItem.fromJson(Map<String, dynamic>.from(raw));
        _notificationController.add(notif);
      }
    } catch (e) {
      debugPrint('Error parsing NotificationCreated payload: $e');
    }
  }

  Future<void> joinTransferGroup(String transferId) async {
    _subscribedTransferId = transferId;
    if (_hubConnection != null && _isConnected) {
      try {
        await _hubConnection!.invoke('JoinTransferGroup', args: [transferId]);
      } catch (e) {
        debugPrint('Error joining transfer group $transferId: $e');
      }
    }
  }

  Future<void> leaveTransferGroup(String transferId) async {
    if (_hubConnection != null && _isConnected) {
      try {
        await _hubConnection!.invoke('LeaveTransferGroup', args: [transferId]);
      } catch (e) {
        debugPrint('Error leaving transfer group $transferId: $e');
      }
    }
    if (_subscribedTransferId == transferId) {
      _subscribedTransferId = null;
    }
  }

  Future<void> disconnect() async {
    if (_hubConnection != null) {
      if (_subscribedTransferId != null && _isConnected) {
        await leaveTransferGroup(_subscribedTransferId!);
      }
      try {
        await _hubConnection!.stop();
      } catch (_) {}
      _hubConnection = null;
    }
    _isConnected = false;
    _connectionStateController.add(false);
  }

  void dispose() {
    disconnect();
    _statusUpdatesController.close();
    _locationUpdatesController.close();
    _notificationController.close();
    _connectionStateController.close();
  }
}
