import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'transfer_api_service.dart';

enum LocationTrackingStatus {
  idle,
  checkingPermission,
  permissionDenied,
  serviceDisabled,
  tracking,
  stopped,
  error,
}

/// Service to broadcast live GPS coordinates from field officer mobile during InTransit status.
/// Handles permission denial safely without crashing and cancels immediately when finished or disposed.
class TransferLocationService {
  final TransferApiService _apiService;
  Timer? _periodicTimer;
  String? _activeTransferId;
  LocationTrackingStatus _status = LocationTrackingStatus.idle;

  final StreamController<LocationTrackingStatus> _statusController =
      StreamController<LocationTrackingStatus>.broadcast();

  Stream<LocationTrackingStatus> get statusStream => _statusController.stream;
  LocationTrackingStatus get status => _status;
  bool get isTracking => _status == LocationTrackingStatus.tracking;

  TransferLocationService({TransferApiService? apiService})
      : _apiService = apiService ?? TransferApiService();

  void _setStatus(LocationTrackingStatus newStatus) {
    _status = newStatus;
    if (!_statusController.isClosed) {
      _statusController.add(newStatus);
    }
  }

  /// Request permission and verify location services are enabled.
  /// Handles permission denial gracefully without throwing or crashing.
  Future<bool> checkAndRequestPermission() async {
    _setStatus(LocationTrackingStatus.checkingPermission);
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('[LocationService] Location services are disabled on device.');
        _setStatus(LocationTrackingStatus.serviceDisabled);
        return false;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('[LocationService] Location permissions denied by user.');
          _setStatus(LocationTrackingStatus.permissionDenied);
          return false;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        debugPrint('[LocationService] Location permissions permanently denied.');
        _setStatus(LocationTrackingStatus.permissionDenied);
        return false;
      }

      return true;
    } catch (e) {
      debugPrint('[LocationService] Error verifying location permissions: $e');
      _setStatus(LocationTrackingStatus.error);
      return false;
    }
  }

  /// Start periodic GPS tracking (~5 seconds) while status is InTransit.
  /// Stops automatically if stopped explicitly, status changes from InTransit, or disposed.
  Future<void> startTracking(String transferId) async {
    if (_activeTransferId == transferId && isTracking) {
      return;
    }

    stopTracking();
    _activeTransferId = transferId;

    final hasPermission = await checkAndRequestPermission();
    if (!hasPermission) {
      debugPrint('[LocationService] Cannot start tracking: permission not granted.');
      return;
    }

    _setStatus(LocationTrackingStatus.tracking);

    // Initial immediate post
    _postCurrentLocation(transferId);

    // Periodic posting every ~5 seconds
    _periodicTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _postCurrentLocation(transferId);
    });
  }

  Future<void> _postCurrentLocation(String transferId) async {
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 4),
      );

      await _apiService.updateLocation(
        transferId: transferId,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        timestamp: position.timestamp,
      );
      debugPrint(
          '[LocationService] Posted GPS for transfer $transferId: (${position.latitude}, ${position.longitude})');
    } catch (e) {
      debugPrint('[LocationService] Failed to post location update: $e');
      // Do not crash; will retry on next tick
    }
  }

  /// Stop tracking immediately.
  void stopTracking() {
    _periodicTimer?.cancel();
    _periodicTimer = null;
    _activeTransferId = null;
    if (_status == LocationTrackingStatus.tracking) {
      _setStatus(LocationTrackingStatus.stopped);
    }
  }

  void dispose() {
    stopTracking();
    _statusController.close();
  }
}
