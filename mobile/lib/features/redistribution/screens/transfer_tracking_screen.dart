import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/constants/app_constants.dart';
import '../models/transfer_models.dart';
import '../services/transfer_api_service.dart';
import '../services/transfer_signalr_service.dart';
import '../services/transfer_location_service.dart';
import '../widgets/transfer_live_map_widget.dart';
import 'notification_inbox_screen.dart';

class TransferTrackingScreen extends StatefulWidget {
  final Transfer transfer;
  final TransferApiService? apiService;
  final TransferSignalRService? signalRService;
  final TransferLocationService? locationService;
  final RouteDetails? initialRoute;
  final bool enablePolling;

  const TransferTrackingScreen({
    super.key,
    required this.transfer,
    this.apiService,
    this.signalRService,
    this.locationService,
    this.initialRoute,
    this.enablePolling = true,
  });

  @override
  State<TransferTrackingScreen> createState() => _TransferTrackingScreenState();
}

class _TransferTrackingScreenState extends State<TransferTrackingScreen> {
  late final TransferApiService _apiService;
  TransferSignalRService? _signalRService;
  TransferLocationService? _locationService;
  StreamSubscription<Transfer>? _signalRSubscription;
  StreamSubscription<TransferLocationUpdate>? _signalRLocationSubscription;
  StreamSubscription<TransferNotificationItem>? _signalRNotificationSubscription;
  StreamSubscription<bool>? _signalRStateSubscription;
  bool _isSignalRConnected = false;
  late Transfer _transfer;
  RouteDetails? _route;
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _pollingTimer;
  Timer? _etaRecalcTimer;
  int _unreadNotifCount = 0;

  double? _lastLatitude;
  double? _lastLongitude;
  DateTime? _lastLocationTime;

  double? _dynamicDistanceKm;
  double? _dynamicDurationMinutes;

  @override
  void initState() {
    super.initState();
    _transfer = widget.transfer;
    _lastLatitude = _transfer.lastLatitude;
    _lastLongitude = _transfer.lastLongitude;
    _lastLocationTime = _transfer.lastLocationAt;

    _apiService = widget.apiService ?? TransferApiService();
    _locationService =
        widget.locationService ?? TransferLocationService(apiService: _apiService);

    if (widget.initialRoute != null) {
      _route = widget.initialRoute;
      _isLoading = false;
      _recalculateDynamicEta();
    } else {
      _fetchRoute();
    }

    _initSignalR();
    _checkAndStartGpsTracking();
    _fetchUnreadNotificationsCount();

    if (widget.enablePolling) {
      _startPolling();
    }

    _startEtaTimer();
  }

  void _startEtaTimer() {
    // Recompute dynamic ETA and remaining distance every 30s
    _etaRecalcTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) {
        _recalculateDynamicEta();
      }
    });
  }

  LatLng get _sourceCoords {
    if (_route?.sourceLatitude != null && _route?.sourceLongitude != null) {
      return LatLng(_route!.sourceLatitude!, _route!.sourceLongitude!);
    }
    if (_route != null && _route!.waypoints.isNotEmpty) {
      return LatLng(_route!.waypoints.first.latitude, _route!.waypoints.first.longitude);
    }
    return const LatLng(6.9271, 79.8612); // Colombo default
  }

  LatLng get _destinationCoords {
    if (_route?.destinationLatitude != null && _route?.destinationLongitude != null) {
      return LatLng(_route!.destinationLatitude!, _route!.destinationLongitude!);
    }
    if (_route != null && _route!.waypoints.isNotEmpty) {
      return LatLng(_route!.waypoints.last.latitude, _route!.waypoints.last.longitude);
    }
    return const LatLng(7.2906, 80.6337); // Kandy default
  }

  double _calculateHaversineDistanceKm(
      double lat1, double lon1, double lat2, double lon2) {
    const earthRadiusKm = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180.0;
    final dLon = (lon2 - lon1) * math.pi / 180.0;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180.0) *
            math.cos(lat2 * math.pi / 180.0) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  void _recalculateDynamicEta() {
    final isTransit = _transfer.status.toLowerCase() == 'intransit';
    if (isTransit && _lastLatitude != null && _lastLongitude != null) {
      final dest = _destinationCoords;
      final directKm = _calculateHaversineDistanceKm(
        _lastLatitude!,
        _lastLongitude!,
        dest.latitude,
        dest.longitude,
      );
      // Realistic road distance ~ 1.25x straight-line, average road speed 40 km/h
      final remainingKm = directKm * 1.25;
      final remainingMins = (remainingKm / 40.0) * 60.0;
      setState(() {
        _dynamicDistanceKm = remainingKm;
        _dynamicDurationMinutes = remainingMins;
      });
    } else {
      setState(() {
        _dynamicDistanceKm = _route?.distanceKm ?? _transfer.estimatedDistanceKm;
        _dynamicDurationMinutes =
            _route?.durationMinutes ?? _transfer.estimatedDurationMinutes;
      });
    }
  }

  void _checkAndStartGpsTracking() {
    // Only post GPS while transfer status is InTransit
    if (_transfer.status.toLowerCase() == 'intransit') {
      _locationService?.startTracking(_transfer.id);
    } else {
      _locationService?.stopTracking();
    }
  }

  void _initSignalR() {
    _signalRService = widget.signalRService ?? TransferSignalRService();
    _signalRSubscription =
        _signalRService!.onTransferStatusChanged.listen((updated) {
      if (mounted && updated.id == _transfer.id) {
        setState(() {
          _transfer = updated;
          if (updated.lastLatitude != null) {
            _lastLatitude = updated.lastLatitude;
            _lastLongitude = updated.lastLongitude;
            _lastLocationTime = updated.lastLocationAt;
          }
        });
        _checkAndStartGpsTracking();
        _recalculateDynamicEta();
      }
    });

    _signalRLocationSubscription =
        _signalRService!.onTransferLocationUpdated.listen((loc) {
      if (mounted && loc.transferId == _transfer.id) {
        setState(() {
          _lastLatitude = loc.latitude;
          _lastLongitude = loc.longitude;
          _lastLocationTime = loc.timestamp;
        });
        _recalculateDynamicEta();
      }
    });

    _signalRNotificationSubscription =
        _signalRService!.onNotificationCreated.listen((notif) {
      if (mounted) {
        setState(() {
          _unreadNotifCount++;
        });
        _showNotificationBanner(notif);
      }
    });

    _signalRStateSubscription =
        _signalRService!.onConnectionStateChanged.listen((connected) {
      if (mounted) {
        setState(() {
          _isSignalRConnected = connected;
        });
      }
    });
    _signalRService!.initAndConnect(transferId: _transfer.id);
  }

  void _showNotificationBanner(TransferNotificationItem notif) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.surface,
        duration: const Duration(seconds: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: AppColors.secondary, width: 1.5),
        ),
        content: Row(
          children: [
            const Icon(Icons.notifications_active_rounded,
                color: AppColors.secondary, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notif.title,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    notif.message,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        action: SnackBarAction(
          label: 'View',
          textColor: AppColors.secondary,
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => NotificationInboxScreen(
                  apiService: _apiService,
                  signalRService: _signalRService,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Future<void> _fetchUnreadNotificationsCount() async {
    try {
      final items = await _apiService.getNotifications(
        audience: 'FieldOfficer',
        unreadOnly: true,
      );
      if (mounted) {
        setState(() {
          _unreadNotifCount = items.length;
        });
      }
    } catch (_) {}
  }

  void _startPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      // Keep polling only as a fallback when the socket is disconnected
      if (mounted && !_isSignalRConnected) {
        _pollUpdates();
      }
    });
  }

  Future<void> _pollUpdates() async {
    try {
      final updatedTransfer = await _apiService.getTransferById(_transfer.id);
      if (mounted) {
        setState(() {
          _transfer = updatedTransfer;
          if (updatedTransfer.lastLatitude != null) {
            _lastLatitude = updatedTransfer.lastLatitude;
            _lastLongitude = updatedTransfer.lastLongitude;
            _lastLocationTime = updatedTransfer.lastLocationAt;
          }
        });
        _checkAndStartGpsTracking();
        _recalculateDynamicEta();
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _locationService?.stopTracking();
    _locationService?.dispose();
    _pollingTimer?.cancel();
    _etaRecalcTimer?.cancel();
    _signalRSubscription?.cancel();
    _signalRLocationSubscription?.cancel();
    _signalRNotificationSubscription?.cancel();
    _signalRStateSubscription?.cancel();
    _signalRService?.disconnect();
    super.dispose();
  }

  Future<void> _fetchRoute() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final routeData = await _apiService.getRoute(_transfer.id);
      if (mounted) {
        setState(() {
          _route = routeData;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final distance = _dynamicDistanceKm ?? _route?.distanceKm ?? _transfer.estimatedDistanceKm;
    final duration = _dynamicDurationMinutes ?? _route?.durationMinutes ?? _transfer.estimatedDurationMinutes;
    final provider = _route?.provider ?? _transfer.routingProvider ?? 'OpenRouteService';
    final isFallback = _route?.isFallback ?? false;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'Tracking ${_transfer.transferNumber}',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                tooltip: 'Notifications',
                onPressed: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => NotificationInboxScreen(
                        apiService: _apiService,
                        signalRService: _signalRService,
                      ),
                    ),
                  );
                  _fetchUnreadNotificationsCount();
                },
              ),
              if (_unreadNotifCount > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.statusRejected,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '$_unreadNotifCount',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchRoute,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.secondary),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppColors.statusRejected),
                        const SizedBox(height: 12),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _fetchRoute,
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
                          child: const Text('Retry Route Calculation'),
                        ),
                      ],
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Uber-Eats-Style Transit Status Header Banner
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppColors.secondary.withOpacity(0.2),
                              AppColors.surface,
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.secondary.withOpacity(0.3)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.local_shipping_rounded,
                                      color: AppColors.secondary,
                                      size: 24,
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      _transfer.status.toUpperCase(),
                                      style: const TextStyle(
                                        color: AppColors.secondary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        letterSpacing: 0.8,
                                      ),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: isFallback
                                        ? AppColors.statusRequested.withOpacity(0.2)
                                        : AppColors.primary.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    isFallback ? 'Haversine Fallback' : provider,
                                    style: TextStyle(
                                      color: isFallback
                                          ? AppColors.statusRequested
                                          : AppColors.primary,
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              _getUberEatsHeadline(_transfer.status),
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _getUberEatsSubheadline(_transfer.status),
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildMetricTile(
                                    label: 'Distance',
                                    value: '${distance.toStringAsFixed(1)} km',
                                    icon: Icons.straighten_rounded,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildMetricTile(
                                    label: 'Est. Duration',
                                    value: '${duration.toStringAsFixed(0)} mins',
                                    icon: Icons.access_time_rounded,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                  // Live GPS Tracking Card
                  if (_lastLatitude != null ||
                      _transfer.status.toLowerCase() == 'intransit') ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.statusDelivered.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: AppColors.statusDelivered.withOpacity(0.35)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.statusDelivered.withOpacity(0.2),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.gps_fixed_rounded,
                              color: AppColors.statusDelivered,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: AppColors.statusDelivered,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    const Text(
                                      'Live Field Officer GPS',
                                      style: TextStyle(
                                        color: AppColors.statusDelivered,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _lastLatitude != null
                                      ? '${_lastLatitude!.toStringAsFixed(5)}, ${_lastLongitude?.toStringAsFixed(5)}'
                                      : 'Acquiring GPS fix (~5s)...',
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_lastLocationTime != null)
                            Text(
                              '${_lastLocationTime!.hour.toString().padLeft(2, '0')}:${_lastLocationTime!.minute.toString().padLeft(2, '0')}:${_lastLocationTime!.second.toString().padLeft(2, '0')}',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 18),

                  // OpenStreetMap Live Route & Courier Map
                  TransferLiveMapWidget(
                    sourceCoords: _sourceCoords,
                    sourceFacilityName:
                        _transfer.sourceFacilityName ?? 'Origin Depot',
                    destinationCoords: _destinationCoords,
                    destinationFacilityName:
                        _transfer.destinationFacilityName,
                    vehicleCoords: (_lastLatitude != null &&
                            _lastLongitude != null)
                        ? LatLng(_lastLatitude!, _lastLongitude!)
                        : null,
                    waypoints: _route?.waypoints ?? const [],
                    distanceKm: distance,
                    durationMinutes: duration,
                    status: _transfer.status,
                  ),

                  const SizedBox(height: 18),

                  // 7-Stage End-to-End Tracking Timeline
                  _build7StageTimeline(),

                  const SizedBox(height: 18),

                  // Route Waypoint Timeline
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Road Route Milestones & Waypoints',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Origin Milestone
                        _buildWaypointTile(
                          isFirst: true,
                          isLast: false,
                          isPassed: true,
                          title: 'Origin / Dispatch Facility',
                          subtitle: _transfer.sourceFacilityName ?? 'Central Warehouse',
                          timeText: 'Dispatched',
                          icon: Icons.storefront_rounded,
                          iconColor: AppColors.primary,
                        ),

                        // Intermediate Waypoints if available
                        if (_route != null && _route!.waypoints.isNotEmpty)
                          ..._route!.waypoints.map((wp) {
                            return _buildWaypointTile(
                              isFirst: false,
                              isLast: false,
                              isPassed: true,
                              title: wp.label.isNotEmpty ? wp.label : 'Highway Checkpoint',
                              subtitle:
                                  'GPS: ${wp.latitude.toStringAsFixed(4)}, ${wp.longitude.toStringAsFixed(4)}',
                              timeText: 'En Route',
                              icon: Icons.navigation_rounded,
                              iconColor: AppColors.secondary,
                            );
                          })
                        else ...[
                          _buildWaypointTile(
                            isFirst: false,
                            isLast: false,
                            isPassed: true,
                            title: 'Transit Corridor',
                            subtitle: 'Expressway corridor via optimal route',
                            timeText: 'Active Transit',
                            icon: Icons.navigation_rounded,
                            iconColor: AppColors.secondary,
                          ),
                        ],

                        // Destination Milestone
                        _buildWaypointTile(
                          isFirst: false,
                          isLast: true,
                          isPassed: _transfer.status.toLowerCase() == 'delivered',
                          title: 'Destination Pharmacy Bay',
                          subtitle: _transfer.destinationFacilityName,
                          timeText: _transfer.status.toLowerCase() == 'delivered'
                              ? 'Delivered'
                              : 'Expected Delivery',
                          icon: Icons.local_hospital_rounded,
                          iconColor: AppColors.accent,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 18),

                  // Cargo Details Summary
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Cargo In Transit',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _transfer.primaryMedicineName,
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              '${_transfer.totalAllocatedQuantity > 0 ? _transfer.totalAllocatedQuantity : _transfer.totalRequestedQuantity} units',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        if (_transfer.primaryBatchNumber != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Batch Lot: ${_transfer.primaryBatchNumber}',
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.background.withOpacity(0.6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.secondary, size: 20),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
              ),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildWaypointTile({
    required bool isFirst,
    required bool isLast,
    required bool isPassed,
    required String title,
    required String subtitle,
    required String timeText,
    required IconData icon,
    required Color iconColor,
  }) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: isPassed ? iconColor.withOpacity(0.2) : AppColors.surfaceHighlight,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isPassed ? iconColor : AppColors.border,
                    width: 2,
                  ),
                ),
                child: Icon(
                  icon,
                  size: 14,
                  color: isPassed ? iconColor : AppColors.textMuted,
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: isPassed ? AppColors.secondary : AppColors.border,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      Text(
                        timeText,
                        style: TextStyle(
                          color: isPassed ? AppColors.secondary : AppColors.textMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getUberEatsHeadline(String status) {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'Preparing Shortage Declaration';
      case 'requested':
        return 'Finding Matching Supplies';
      case 'proposed':
        return 'Awaiting Manager Approval';
      case 'approved':
        return 'Reserving Batch at Depot';
      case 'reserved':
        return 'Ready for Courier Pickup';
      case 'intransit':
        return 'Your medicines are on the way';
      case 'delivered':
        return 'Medicines Delivered';
      case 'rejected':
        return 'Transfer Request Rejected';
      case 'cancelled':
        return 'Transfer Cancelled';
      default:
        return 'Processing Redistribution';
    }
  }

  String _getUberEatsSubheadline(String status) {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'Drafting request and checking inventory requirements';
      case 'requested':
        return 'Request submitted, searching candidate supplier depots';
      case 'proposed':
        return 'Candidate sources matched, awaiting administrative review';
      case 'approved':
        return 'Approved by manager, reserving stock at source facility';
      case 'reserved':
        return 'Batch packed and staged at depot, courier assigned';
      case 'intransit':
        return 'Courier has picked up items and is delivering live';
      case 'delivered':
        return 'Consignment arrived at destination, ready for receipt verification';
      case 'rejected':
        return 'Transfer request was rejected by administrative management';
      case 'cancelled':
        return 'Transfer operation has been cancelled';
      default:
        return 'Tracking redistribution pipeline';
    }
  }

  int _getStageIndex(String status) {
    switch (status.toLowerCase()) {
      case 'draft':
        return 0;
      case 'requested':
        return 1;
      case 'proposed':
        return 2;
      case 'approved':
        return 3;
      case 'reserved':
        return 4;
      case 'intransit':
        return 5;
      case 'delivered':
        return 6;
      default:
        return 0;
    }
  }

  Widget _build7StageTimeline() {
    final stages = [
      {
        'status': 'Draft',
        'title': 'Shortage Declared',
        'subtitle': 'Drafting redistribution request',
        'icon': Icons.edit_note_rounded,
      },
      {
        'status': 'Requested',
        'title': 'Supplies Requested',
        'subtitle': 'Finding matching inventory',
        'icon': Icons.send_rounded,
      },
      {
        'status': 'Proposed',
        'title': 'Candidate Proposed',
        'subtitle': 'Awaiting manager approval',
        'icon': Icons.rule_folder_rounded,
      },
      {
        'status': 'Approved',
        'title': 'Transfer Approved',
        'subtitle': 'Reserving batch at source depot',
        'icon': Icons.thumb_up_alt_rounded,
      },
      {
        'status': 'Reserved',
        'title': 'Batch Reserved',
        'subtitle': 'Packed, ready for courier pickup',
        'icon': Icons.inventory_2_rounded,
      },
      {
        'status': 'InTransit',
        'title': 'Out for Delivery',
        'subtitle': 'Courier en route to facility',
        'icon': Icons.local_shipping_rounded,
      },
      {
        'status': 'Delivered',
        'title': 'Delivered',
        'subtitle': 'Arrived, verify count & batch',
        'icon': Icons.verified_rounded,
      },
    ];

    final currentIndex = _getStageIndex(_transfer.status);
    final isRejectedOrCancelled =
        _transfer.status.toLowerCase() == 'rejected' ||
        _transfer.status.toLowerCase() == 'cancelled';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Redistribution Progress',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceHighlight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isRejectedOrCancelled
                      ? _transfer.status.toUpperCase()
                      : 'Stage ${currentIndex + 1} of 7',
                  style: TextStyle(
                    color: isRejectedOrCancelled
                        ? AppColors.statusRejected
                        : AppColors.secondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...List.generate(stages.length, (index) {
            final stage = stages[index];
            final isCompleted = !isRejectedOrCancelled && currentIndex > index;
            final isCurrent = !isRejectedOrCancelled && currentIndex == index;
            final isLast = index == stages.length - 1;

            Color nodeColor;
            if (isCompleted) {
              nodeColor = AppColors.statusDelivered;
            } else if (isCurrent) {
              nodeColor = AppColors.secondary;
            } else {
              nodeColor = AppColors.textMuted.withOpacity(0.4);
            }

            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    children: [
                      Container(
                        width: 26,
                        height: 26,
                        decoration: BoxDecoration(
                          color: isCompleted
                              ? AppColors.statusDelivered.withOpacity(0.2)
                              : isCurrent
                                  ? AppColors.secondary.withOpacity(0.2)
                                  : AppColors.surfaceHighlight,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: nodeColor,
                            width: isCurrent ? 2.5 : 1.5,
                          ),
                        ),
                        child: Center(
                          child: isCompleted
                              ? const Icon(
                                  Icons.check_rounded,
                                  size: 14,
                                  color: AppColors.statusDelivered,
                                )
                              : Icon(
                                  stage['icon'] as IconData,
                                  size: 13,
                                  color: isCurrent
                                      ? AppColors.secondary
                                      : AppColors.textMuted,
                                ),
                        ),
                      ),
                      if (!isLast)
                        Expanded(
                          child: Container(
                            width: 2,
                            color: isCompleted
                                ? AppColors.statusDelivered
                                : AppColors.border,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(bottom: isLast ? 0 : 16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                stage['title'] as String,
                                style: TextStyle(
                                  color: isCurrent
                                      ? AppColors.textPrimary
                                      : isCompleted
                                          ? AppColors.textPrimary
                                          : AppColors.textMuted,
                                  fontWeight: isCurrent
                                      ? FontWeight.bold
                                      : FontWeight.w500,
                                  fontSize: 13,
                                ),
                              ),
                              if (isCurrent)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: AppColors.secondary.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text(
                                    'ACTIVE',
                                    style: TextStyle(
                                      color: AppColors.secondary,
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            stage['subtitle'] as String,
                            style: TextStyle(
                              color: isCurrent
                                  ? AppColors.textSecondary
                                  : AppColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

