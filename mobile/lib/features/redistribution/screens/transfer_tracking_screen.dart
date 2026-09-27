import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../models/transfer_models.dart';
import '../services/transfer_api_service.dart';

class TransferTrackingScreen extends StatefulWidget {
  final Transfer transfer;
  final TransferApiService? apiService;
  final RouteDetails? initialRoute;

  const TransferTrackingScreen({
    super.key,
    required this.transfer,
    this.apiService,
    this.initialRoute,
  });

  @override
  State<TransferTrackingScreen> createState() => _TransferTrackingScreenState();
}

class _TransferTrackingScreenState extends State<TransferTrackingScreen> {
  late final TransferApiService _apiService;
  RouteDetails? _route;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? TransferApiService();
    if (widget.initialRoute != null) {
      _route = widget.initialRoute;
      _isLoading = false;
    } else {
      _fetchRoute();
    }
  }

  Future<void> _fetchRoute() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final routeData = await _apiService.getRoute(widget.transfer.id);
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
    final distance = _route?.distanceKm ?? widget.transfer.estimatedDistanceKm;
    final duration = _route?.durationMinutes ?? widget.transfer.estimatedDurationMinutes;
    final provider = _route?.provider ?? widget.transfer.routingProvider ?? 'OpenRouteService';
    final isFallback = _route?.isFallback ?? false;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'Tracking ${widget.transfer.transferNumber}',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        actions: [
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
                      // Transit Status Header Banner
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
                                  widget.transfer.status.toUpperCase(),
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
                          subtitle: widget.transfer.sourceFacilityName ?? 'Central Warehouse',
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
                          isPassed: widget.transfer.status.toLowerCase() == 'delivered',
                          title: 'Destination Pharmacy Bay',
                          subtitle: widget.transfer.destinationFacilityName,
                          timeText: widget.transfer.status.toLowerCase() == 'delivered'
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
                              widget.transfer.primaryMedicineName,
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              '${widget.transfer.totalAllocatedQuantity > 0 ? widget.transfer.totalAllocatedQuantity : widget.transfer.totalRequestedQuantity} units',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        if (widget.transfer.primaryBatchNumber != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Batch Lot: ${widget.transfer.primaryBatchNumber}',
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
}
