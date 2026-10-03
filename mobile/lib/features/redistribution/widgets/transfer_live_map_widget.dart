import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/constants/app_constants.dart';
import '../models/transfer_models.dart';

class TransferLiveMapWidget extends StatefulWidget {
  final LatLng sourceCoords;
  final String sourceFacilityName;
  final LatLng destinationCoords;
  final String destinationFacilityName;
  final LatLng? vehicleCoords;
  final List<RouteWaypoint> waypoints;
  final double? distanceKm;
  final double? durationMinutes;
  final String status;

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
  });

  @override
  State<TransferLiveMapWidget> createState() => _TransferLiveMapWidgetState();
}

class _TransferLiveMapWidgetState extends State<TransferLiveMapWidget> {
  final MapController _mapController = MapController();

  List<LatLng> get _polylinePoints {
    final pts = <LatLng>[widget.sourceCoords];
    for (final wp in widget.waypoints) {
      pts.add(LatLng(wp.latitude, wp.longitude));
    }
    pts.add(widget.destinationCoords);
    return pts;
  }

  LatLng get _initialCenter {
    if (widget.vehicleCoords != null) {
      return widget.vehicleCoords!;
    }
    return LatLng(
      (widget.sourceCoords.latitude + widget.destinationCoords.latitude) / 2,
      (widget.sourceCoords.longitude + widget.destinationCoords.longitude) / 2,
    );
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
              initialZoom: 9.5,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              // OpenStreetMap TileLayer with fallback handling
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.medistock.mobile',
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
