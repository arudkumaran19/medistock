import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/network/signalr_client.dart';

class LocationPublisher {
  static final LocationPublisher _instance = LocationPublisher._internal();
  factory LocationPublisher() => _instance;
  LocationPublisher._internal();

  Timer? _timer;
  bool _isPublishing = false;
  final SignalRClient _signalRClient = SignalRClient();

  bool get isPublishing => _isPublishing;

  Future<bool> requestPermissions() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return false;
    }
    if (permission == LocationPermission.deniedForever) return false;
    return true;
  }

  void startPublishing({required String activeTransferId}) async {
    if (_isPublishing) return;
    _isPublishing = true;
    await _signalRClient.connect();

    _timer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      try {
        Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );
        if (kDebugMode) {
          debugPrint('🛰️ [GPS Publisher] Lat: ${position.latitude}, Lng: ${position.longitude}');
        }
        // Publish through SignalR or POST /api/transfers/{id}/location
      } catch (e) {
        if (kDebugMode) {
          debugPrint('⚠️ [GPS Publisher Error] $e');
        }
      }
    });
  }

  void stopPublishing() {
    _timer?.cancel();
    _timer = null;
    _isPublishing = false;
  }
}
