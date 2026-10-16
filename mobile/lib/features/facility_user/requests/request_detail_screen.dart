import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/network/signalr_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/state_views.dart';
import '../../../shared/widgets/status_chip.dart';
import '../../redistribution/widgets/transfer_live_map_widget.dart';
import 'data/transfer_repository.dart';

class RequestDetailScreen extends ConsumerStatefulWidget {
  final String requestId;

  const RequestDetailScreen({super.key, required this.requestId});

  @override
  ConsumerState<RequestDetailScreen> createState() => _RequestDetailScreenState();
}

class _RequestDetailScreenState extends ConsumerState<RequestDetailScreen> {
  final SignalRClient _signalRClient = SignalRClient();
  final MapController _mapController = MapController();

  StreamSubscription? _locationSub;
  LatLng? _liveVehiclePos;
  bool _isConfirming = false;

  @override
  void initState() {
    super.initState();
    _connectSignalR();
  }

  void _connectSignalR() async {
    try {
      await _signalRClient.connect();
      await _signalRClient.joinTransferGroup(widget.requestId);

      _locationSub = _signalRClient.onTransferLocationUpdated.listen((data) {
        if (!mounted) return;
        final tid = data['transferId']?.toString();
        if (tid == null || tid.isEmpty || tid.toLowerCase() == widget.requestId.toLowerCase()) {
          final lat = (data['latitude'] as num?)?.toDouble();
          final lng = (data['longitude'] as num?)?.toDouble();
          if (lat != null && lng != null) {
            setState(() {
              _liveVehiclePos = LatLng(lat, lng);
            });
            _mapController.move(_liveVehiclePos!, _mapController.camera.zoom);
          }
        }
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _locationSub?.cancel();
    _signalRClient.leaveTransferGroup(widget.requestId);
    super.dispose();
  }

  Future<void> _handleConfirmReceipt() async {
    setState(() => _isConfirming = true);
    try {
      await ref.read(transferRepositoryProvider).confirmReceipt(widget.requestId, 'Confirmed by destination facility pharmacist');
      ref.invalidate(transferByIdProvider(widget.requestId));
      ref.invalidate(myRequestsProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delivery confirmed! Medicine stock restocked at destination facility.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to confirm receipt: ${e.toString().replaceAll("Exception: ", "")}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isConfirming = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final transferAsync = ref.watch(transferByIdProvider(widget.requestId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: transferAsync.when(
          data: (t) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t.transferNumber, style: AppTextStyles.titleSmall),
              Text(
                t.items.isNotEmpty ? t.items.first.itemName : 'Medicine Requisition',
                style: AppTextStyles.bodySmall.copyWith(fontSize: 10),
              ),
            ],
          ),
          loading: () => const Text('Loading requisition...'),
          error: (_, __) => const Text('Transfer Requisition'),
        ),
        actions: [
          transferAsync.maybeWhen(
            data: (t) => Container(
              margin: const EdgeInsets.only(right: 16),
              child: StatusChip(status: t.status.toUpperCase()),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: transferAsync.when(
        loading: () => const LoadingView(label: 'Loading transfer tracking details...'),
        error: (err, _) => ErrorView(
          message: 'Failed to load transfer: $err',
          onRetry: () => ref.refresh(transferByIdProvider(widget.requestId)),
        ),
        data: (transfer) {
          final routeAsync = ref.watch(transferRouteProvider(widget.requestId));
          final route = routeAsync.valueOrNull;

          final sLat = route?.sourceLatitude;
          final sLng = route?.sourceLongitude;
          final LatLng? sourcePos = (sLat != null && sLng != null && sLat != 0 && sLng != 0)
              ? LatLng(sLat, sLng)
              : (route != null && route.waypoints.isNotEmpty && route.waypoints.first.latitude != 0)
                  ? LatLng(route.waypoints.first.latitude, route.waypoints.first.longitude)
                  : null;

          final dLat = route?.destinationLatitude;
          final dLng = route?.destinationLongitude;
          final LatLng? destPos = (dLat != null && dLng != null && dLat != 0 && dLng != 0)
              ? LatLng(dLat, dLng)
              : (route != null && route.waypoints.isNotEmpty && route.waypoints.last.latitude != 0)
                  ? LatLng(route.waypoints.last.latitude, route.waypoints.last.longitude)
                  : null;

          final LatLng? vehiclePos = _liveVehiclePos ??
              (transfer.currentLatitude != 0 && transfer.currentLongitude != 0
                  ? LatLng(transfer.currentLatitude, transfer.currentLongitude)
                  : null);

          final statusLower = transfer.status.toLowerCase();
          final isDelivered = statusLower == 'delivered' || statusLower == 'received';
          final isInTransit = statusLower == 'intransit' || statusLower == 'dispatched';
          final canConfirm = isInTransit || statusLower == 'reserved' || statusLower == 'approved';

          final hasValidMap = sourcePos != null && destPos != null;

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(transferByIdProvider(widget.requestId));
              ref.invalidate(transferRouteProvider(widget.requestId));
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Live Interactive Map View
                  if (hasValidMap)
                    TransferLiveMapWidget(
                      sourceCoords: sourcePos,
                      sourceFacilityName: transfer.sourceFacilityName.isNotEmpty
                          ? transfer.sourceFacilityName
                          : 'Origin Depot',
                      destinationCoords: destPos,
                      destinationFacilityName: transfer.destinationFacilityName.isNotEmpty
                          ? transfer.destinationFacilityName
                          : 'Destination Facility',
                      vehicleCoords: vehiclePos,
                      waypoints: route?.waypoints ?? const [],
                      distanceKm: route?.distanceKm,
                      durationMinutes: route?.durationMinutes,
                      status: transfer.status,
                    )
                  else
                    Container(
                      height: 220,
                      width: double.infinity,
                      margin: const EdgeInsets.all(16),
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
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

                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Logistics Transfer Card
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('REQUISITION MANIFEST', style: AppTextStyles.badge.copyWith(color: AppColors.primary)),
                              const SizedBox(height: 8),
                              ...transfer.items.map((item) => Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(item.itemName, style: AppTextStyles.titleMedium),
                                    ),
                                    Text(
                                      '${item.requestedQuantity} ${item.unitOfMeasure}',
                                      style: AppTextStyles.titleMedium.copyWith(color: AppColors.primaryLight),
                                    ),
                                  ],
                                ),
                              )),
                              const Divider(height: 20),
                              Row(
                                children: [
                                  const Icon(Icons.location_on_rounded, size: 16, color: AppColors.secondary),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'From: ${transfer.sourceFacilityName.isNotEmpty ? transfer.sourceFacilityName : "Proposed by Planning Agent"}',
                                      style: AppTextStyles.bodySmall,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.flag_rounded, size: 16, color: AppColors.primary),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'To: ${transfer.destinationFacilityName}',
                                      style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Officer Information (if assigned)
                        if (transfer.officerName != null && transfer.officerName!.isNotEmpty && transfer.officerName != 'Assigned Officer')
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                const CircleAvatar(
                                  radius: 20,
                                  backgroundColor: AppColors.secondaryLight,
                                  child: Icon(Icons.person_rounded, color: AppColors.secondary),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(transfer.officerName!, style: AppTextStyles.titleSmall),
                                      Text(transfer.officerPhone ?? 'Certified Field Officer', style: AppTextStyles.bodySmall),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),

                        const SizedBox(height: 24),

                        // Chain of Custody Timeline
                        Text('Chain of Custody', style: AppTextStyles.titleLarge),
                        const SizedBox(height: 14),

                        _CustodyStep(
                          title: '1. Requisition Submitted',
                          desc: 'Request formally raised from facility demand and alert.',
                          isDone: true,
                        ),
                        _CustodyStep(
                          title: '2. Source Proposal & Review',
                          desc: statusLower == 'draft' || statusLower == 'requested'
                              ? 'Analyzing candidate supplying facilities...'
                              : 'Optimal supplying facility proposed by Planning Agent.',
                          isDone: statusLower != 'draft' && statusLower != 'requested',
                          isCurrent: statusLower == 'proposed',
                        ),
                        _CustodyStep(
                          title: '3. Manager Approved & Task Reserved',
                          desc: 'Redistribution manager approved and officer reserved assignment.',
                          isDone: statusLower == 'approved' || statusLower == 'reserved' || isInTransit || isDelivered,
                          isCurrent: statusLower == 'approved' || statusLower == 'reserved',
                        ),
                        _CustodyStep(
                          title: '4. Dispatched / In Transit',
                          desc: 'Cargo in transit with active GPS telemetry stream.',
                          isDone: isDelivered || isInTransit,
                          isCurrent: isInTransit,
                        ),
                        _CustodyStep(
                          title: '5. Delivered & Inventory Restocked',
                          desc: 'Goods received at facility dock and stock adjusted.',
                          isDone: isDelivered,
                          isCurrent: isDelivered,
                        ),

                        const SizedBox(height: 28),

                        // Confirm Receipt Button
                        if (isDelivered)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.successLight,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.check_circle_rounded, color: AppColors.success),
                                const SizedBox(width: 8),
                                Text(
                                  'Delivery Completed & Stock Restocked',
                                  style: AppTextStyles.titleSmall.copyWith(color: AppColors.success, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          )
                        else if (canConfirm)
                          ElevatedButton(
                            onPressed: _isConfirming ? null : _handleConfirmReceipt,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.success,
                              minimumSize: const Size(double.infinity, 48),
                            ),
                            child: _isConfirming
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.inventory_2_rounded),
                                      SizedBox(width: 8),
                                      Text('Confirm Goods Receipt & Restock'),
                                    ],
                                  ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _CustodyStep extends StatelessWidget {
  final String title;
  final String desc;
  final bool isDone;
  final bool isCurrent;

  const _CustodyStep({
    required this.title,
    required this.desc,
    required this.isDone,
    this.isCurrent = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Icon(
              isDone
                  ? Icons.check_circle_rounded
                  : isCurrent
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_unchecked_rounded,
              size: 20,
              color: isDone
                  ? AppColors.success
                  : isCurrent
                      ? AppColors.secondary
                      : AppColors.textMuted,
            ),
            Container(
              width: 2,
              height: 38,
              color: isDone ? AppColors.success : AppColors.border,
            ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTextStyles.titleSmall.copyWith(
                  color: isCurrent
                      ? AppColors.secondary
                      : isDone
                          ? AppColors.textPrimary
                          : AppColors.textMuted,
                  fontWeight: isCurrent || isDone ? FontWeight.bold : FontWeight.normal,
                ),
              ),
              const SizedBox(height: 2),
              Text(desc, style: AppTextStyles.bodySmall),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ],
    );
  }
}
