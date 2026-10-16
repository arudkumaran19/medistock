import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/text_styles.dart';
import '../models/transfer_models.dart';

/// Fake transparent 1x1 tile provider for test and offline environments.
class EmptyTileProvider extends TileProvider {
  EmptyTileProvider();

  static const List<int> _kTransparentImage = <int>[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
  ];

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) {
    return MemoryImage(Uint8List.fromList(_kTransparentImage));
  }
}

class TransferLiveMapWidget extends StatefulWidget {
  static TileProvider? defaultTileProvider;
  static void Function(TileImage tile, Object error, StackTrace? stackTrace)? defaultErrorTileCallback;

  final LatLng sourceCoords;
  final String sourceFacilityName;
  final LatLng destinationCoords;
  final String destinationFacilityName;
  final LatLng? vehicleCoords;
  final List<RouteWaypoint> waypoints;
  final double? distanceKm;
  final double? durationMinutes;
  final String status;
  final TileProvider? tileProvider;
  final void Function(TileImage tile, Object error, StackTrace? stackTrace)? errorTileCallback;

  const TransferLiveMapWidget({
    super.key,
    required this.sourceCoords,
    required this.sourceFacilityName,
    required this.destinationCoords,
    required this.destinationFacilityName,
    this.vehicleCoords,
    this.waypoints = const [],
    this.distanceKm,
    this.durationMinutes,
    required this.status,
    this.tileProvider,
    this.errorTileCallback,
  });

  @override
  State<TransferLiveMapWidget> createState() => _TransferLiveMapWidgetState();
}

class _TransferLiveMapWidgetState extends State<TransferLiveMapWidget> {
  final MapController _mapController = MapController();

  bool get _hasValidCoords =>
      widget.sourceCoords.latitude != 0 &&
      widget.sourceCoords.longitude != 0 &&
      widget.destinationCoords.latitude != 0 &&
      widget.destinationCoords.longitude != 0;

  List<LatLng> get _polylinePoints {
    final pts = <LatLng>[widget.sourceCoords];
    for (final wp in widget.waypoints) {
      if (wp.latitude != 0 && wp.longitude != 0) {
        pts.add(LatLng(wp.latitude, wp.longitude));
      }
    }
    pts.add(widget.destinationCoords);
    return pts;
  }

  LatLng get _initialCenter {
    if (widget.vehicleCoords != null &&
        widget.vehicleCoords!.latitude != 0 &&
        widget.vehicleCoords!.longitude != 0) {
      return widget.vehicleCoords!;
    }
    if (_hasValidCoords) {
      return LatLng(
        (widget.sourceCoords.latitude + widget.destinationCoords.latitude) / 2,
        (widget.sourceCoords.longitude + widget.destinationCoords.longitude) / 2,
      );
    }
    return const LatLng(
      AppConstants.sriLankaCenterLatitude,
      AppConstants.sriLankaCenterLongitude,
    );
  }

  void _fitBounds() {
    if (!_hasValidCoords) return;
    final pts = <LatLng>[widget.sourceCoords];
    for (final wp in widget.waypoints) {
      if (wp.latitude != 0 && wp.longitude != 0) {
        pts.add(LatLng(wp.latitude, wp.longitude));
      }
    }
    pts.add(widget.destinationCoords);
    if (widget.vehicleCoords != null &&
        widget.vehicleCoords!.latitude != 0 &&
        widget.vehicleCoords!.longitude != 0) {
      pts.add(widget.vehicleCoords!);
    }
    if (pts.length >= 2) {
      try {
        final bounds = LatLngBounds.fromPoints(pts);
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: bounds,
            padding: const EdgeInsets.all(40),
          ),
        );
      } catch (_) {}
    }
  }

  @override
  void didUpdateWidget(TransferLiveMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.vehicleCoords != oldWidget.vehicleCoords ||
        widget.waypoints.length != oldWidget.waypoints.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fitBounds());
    }
  }

  bool get _isTestEnvironment {
    if (kIsWeb) return false;
    try {
      return Platform.environment.containsKey('FLUTTER_TEST');
    } catch (_) {
      return false;
    }
  }

  TileProvider get _effectiveTileProvider {
    if (widget.tileProvider != null) return widget.tileProvider!;
    if (TransferLiveMapWidget.defaultTileProvider != null) {
      return TransferLiveMapWidget.defaultTileProvider!;
    }
    if (_isTestEnvironment) {
      return EmptyTileProvider();
    }
    return NetworkTileProvider(
      headers: const {'User-Agent': 'com.medistock.mobile'},
    );
  }

  void Function(TileImage, Object, StackTrace?) get _effectiveErrorTileCallback {
    return widget.errorTileCallback ??
        TransferLiveMapWidget.defaultErrorTileCallback ??
        (tile, error, stackTrace) {
          // Gracefully absorb tile error without throwing
        };
  }

  @override
  Widget build(BuildContext context) {
    final polylines = _polylinePoints;
    final isTransit = widget.status.toLowerCase() == 'intransit';

    return Container(
      height: 380,
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surface, // Plain background fallback if tiles unreachable
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Underlying grid pattern indicating route layout even if tile server is offline
          Positioned.fill(
            child: Container(
              color: AppColors.surfaceHighlight.withOpacity(0.4),
            ),
          ),

          // Flutter Map with OpenStreetMap tiles
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _initialCenter,
              initialZoom: AppConstants.sriLankaDefaultZoom,
              onMapReady: _fitBounds,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              // OpenStreetMap TileLayer with fallback handling
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.medistock.mobile',
                tileProvider: _effectiveTileProvider,
                errorTileCallback: _effectiveErrorTileCallback,
                tileBuilder: (context, tileWidget, tile) {
                  // Ensure if tile fails to load or offline, it gracefully blends
                  return tileWidget;
                },
              ),

              // Route Polyline
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: polylines,
                    strokeWidth: 4.5,
                    color: isTransit ? AppColors.secondary : AppColors.primary,
                    borderColor: Colors.black.withOpacity(0.2),
                    borderStrokeWidth: 1.5,
                  ),
                ],
              ),

              // Markers Layer: Source Depot, Destination Shortage Center, and Moving Vehicle
              MarkerLayer(
                markers: [
                  // 1. Source Facility Marker (Depot)
                  Marker(
                    point: widget.sourceCoords,
                    width: 44,
                    height: 44,
                    child: Tooltip(
                      message: 'Depot: ${widget.sourceFacilityName}',
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.4),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.local_hospital_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                    ),
                  ),

                  // 2. Destination Facility Marker (Shortage Center)
                  Marker(
                    point: widget.destinationCoords,
                    width: 44,
                    height: 44,
                    child: Tooltip(
                      message: 'Destination: ${widget.destinationFacilityName}',
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.statusRejected,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.statusRejected.withOpacity(0.4),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.location_on_rounded,
                          color: Colors.white,
                          size: 24,
                        ),
                      ),
                    ),
                  ),

                  // 3. Moving Field Officer Vehicle Marker
                  if (widget.vehicleCoords != null)
                    Marker(
                      point: widget.vehicleCoords!,
                      width: 52,
                      height: 52,
                      child: Tooltip(
                        message: 'Field Officer Courier (Live GPS)',
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            // Pulsing radar wave
                            Container(
                              width: 50,
                              height: 50,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.secondary.withOpacity(0.3),
                              ),
                            ),
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: AppColors.secondary,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.secondary.withOpacity(0.6),
                                    blurRadius: 10,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.delivery_dining_rounded,
                                color: Colors.white,
                                size: 22,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),

          // Uber-Eats-Style Floating Live Status & ETA Card
          Positioned(
            top: 12,
            left: 12,
            right: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surface.withOpacity(0.92),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.35),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: (isTransit ? AppColors.secondary : AppColors.primary)
                              .withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          isTransit
                              ? Icons.local_shipping_rounded
                              : Icons.navigation_rounded,
                          color: isTransit ? AppColors.secondary : AppColors.primary,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isTransit
                                ? 'Your medicines are on the way'
                                : 'Route Transit Plan',
                            style: TextStyle(
                              color: isTransit ? AppColors.secondary : AppColors.primary,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            widget.distanceKm != null
                                ? '${widget.distanceKm!.toStringAsFixed(1)} km left'
                                : 'Calculating distance...',
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  if (widget.durationMinutes != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceHighlight,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '~${widget.durationMinutes!.toStringAsFixed(0)} mins',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Location unavailable overlay when coordinates are (0,0) or missing
          if (!_hasValidCoords)
            Positioned.fill(
              child: Container(
                color: AppColors.surface.withOpacity(0.92),
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.location_off_rounded, size: 40, color: AppColors.textMuted),
                    const SizedBox(height: 12),
                    Text('Location unavailable', style: AppTextStyles.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                      'Facility coordinates or transit route data are not available.',
                      style: AppTextStyles.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),

          // OSM Attribution Tag
          Positioned(
            bottom: 6,
            right: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                '© OpenStreetMap',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 9,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
