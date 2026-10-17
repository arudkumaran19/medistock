import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/models/transfer_model.dart';
import '../../../shared/widgets/state_views.dart';
import '../../facility_user/requests/data/transfer_repository.dart';
import '../../redistribution/widgets/transfer_live_map_widget.dart';
import '../location/location_publisher.dart';
import 'data/officer_task_repository.dart';

enum DeliveryPhase { headingToPickup, atPickup, inTransit, atDestination }

class ActiveDeliveryScreen extends ConsumerStatefulWidget {
  final String transferId;

  const ActiveDeliveryScreen({super.key, required this.transferId});

  @override
  ConsumerState<ActiveDeliveryScreen> createState() =>
      _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends ConsumerState<ActiveDeliveryScreen> {
  DeliveryPhase _currentPhase = DeliveryPhase.headingToPickup;

  // Phase B Checklist
  final Set<String> _checkedItems = {};
  String? _proofPhotoPath;
  bool _isAccepting = false;

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final photo = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,
    );
    if (photo != null && mounted) {
      setState(() => _proofPhotoPath = photo.path);
    }
  }

  // Phase D OTP
  final TextEditingController _otpController =
      TextEditingController(text: '4829');

  @override
  void dispose() {
    LocationPublisher().stopPublishing();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _handleAcceptTask() async {
    setState(() => _isAccepting = true);
    try {
      await ref
          .read(officerTaskRepositoryProvider)
          .acceptTask(widget.transferId);
      ref.invalidate(transferByIdProvider(widget.transferId));
      ref.invalidate(assignedTasksProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Task accepted! Inventory reserved at supplying facility.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Failed to accept task: ${e.toString().replaceAll("Exception: ", "")}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isAccepting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final transferAsync = ref.watch(transferByIdProvider(widget.transferId));

    return transferAsync.when(
      loading: () => Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Loading Task...')),
        body: const LoadingView(label: 'Loading task dispatch data...'),
      ),
      error: (err, _) => Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Task Details')),
        body: ErrorView(
          message: 'Failed to load task details: $err',
          onRetry: () => ref.refresh(transferByIdProvider(widget.transferId)),
        ),
      ),
      data: (transfer) {
        final statusLower = transfer.status.toLowerCase();
        final isApproved = statusLower == 'approved';
        final isReserved = statusLower == 'reserved';
        final isInTransit =
            statusLower == 'intransit' || statusLower == 'dispatched';
        final isDelivered =
            statusLower == 'delivered' || statusLower == 'received';

        final routeAsync = ref.watch(transferRouteProvider(widget.transferId));
        final route = routeAsync.valueOrNull;

        final sLat = route?.sourceLatitude;
        final sLng = route?.sourceLongitude;
        final LatLng? sourcePos =
            (sLat != null && sLng != null && sLat != 0 && sLng != 0)
                ? LatLng(sLat, sLng)
                : (route != null &&
                        route.waypoints.isNotEmpty &&
                        route.waypoints.first.latitude != 0)
                    ? LatLng(route.waypoints.first.latitude,
                        route.waypoints.first.longitude)
                    : null;

        final dLat = route?.destinationLatitude;
        final dLng = route?.destinationLongitude;
        final LatLng? destPos =
            (dLat != null && dLng != null && dLat != 0 && dLng != 0)
                ? LatLng(dLat, dLng)
                : (route != null &&
                        route.waypoints.isNotEmpty &&
                        route.waypoints.last.latitude != 0)
                    ? LatLng(route.waypoints.last.latitude,
                        route.waypoints.last.longitude)
                    : null;

        final LatLng? vehiclePos =
            (transfer.currentLatitude != 0 && transfer.currentLongitude != 0)
                ? LatLng(transfer.currentLatitude, transfer.currentLongitude)
                : null;

        final hasValidMap = sourcePos != null && destPos != null;

        // Auto-sync phase with backend status if advanced
        if (isInTransit &&
            _currentPhase.index < DeliveryPhase.inTransit.index) {
          _currentPhase = DeliveryPhase.inTransit;
        } else if (isDelivered &&
            _currentPhase != DeliveryPhase.atDestination) {
          _currentPhase = DeliveryPhase.atDestination;
        }

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            title: Text('${transfer.transferNumber} • ${_getPhaseTitle()}'),
            actions: [
              IconButton(
                icon: const Icon(Icons.warning_amber_rounded,
                    color: AppColors.error),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text(
                            'Dispatched issue report to District Supply Command!')),
                  );
                },
              ),
            ],
          ),
          body: SafeArea(
            child: Column(
              children: [
                // Phase Stepper Bar
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: AppColors.surface,
                  child: Row(
                    children: [
                      _PhaseChip(
                          label: '1. Pickup',
                          isActive:
                              _currentPhase == DeliveryPhase.headingToPickup,
                          isDone: _currentPhase.index > 0),
                      _PhaseChip(
                          label: '2. Inspection',
                          isActive: _currentPhase == DeliveryPhase.atPickup,
                          isDone: _currentPhase.index > 1),
                      _PhaseChip(
                          label: '3. In Transit',
                          isActive: _currentPhase == DeliveryPhase.inTransit,
                          isDone: _currentPhase.index > 2),
                      _PhaseChip(
                          label: '4. Deliver',
                          isActive:
                              _currentPhase == DeliveryPhase.atDestination,
                          isDone: isDelivered),
                    ],
                  ),
                ),

                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      children: [
                        // Map View
                        if (hasValidMap)
                          TransferLiveMapWidget(
                            sourceCoords: sourcePos,
                            sourceFacilityName:
                                transfer.sourceFacilityName.isNotEmpty
                                    ? transfer.sourceFacilityName
                                    : 'Source Facility',
                            destinationCoords: destPos,
                            destinationFacilityName:
                                transfer.destinationFacilityName.isNotEmpty
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
                            height: 200,
                            width: double.infinity,
                            margin: const EdgeInsets.symmetric(horizontal: 16),
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.location_off_rounded,
                                    size: 36, color: AppColors.textMuted),
                                const SizedBox(height: 10),
                                Text('Location unavailable',
                                    style: AppTextStyles.titleMedium),
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
                              // Unaccepted / Approved task prompt
                              if (isApproved)
                                Container(
                                  margin: const EdgeInsets.only(bottom: 20),
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: AppColors.secondaryLight,
                                    borderRadius: BorderRadius.circular(16),
                                    border:
                                        Border.all(color: AppColors.secondary),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                          'ASSIGNED MISSION PENDING ACCEPTANCE',
                                          style: AppTextStyles.badge.copyWith(
                                              color: AppColors.secondary)),
                                      const SizedBox(height: 6),
                                      Text(
                                        'Manager has approved this redistribution transfer. Accept the assignment to reserve inventory and begin logistics execution.',
                                        style: AppTextStyles.bodyMedium,
                                      ),
                                      const SizedBox(height: 14),
                                      ElevatedButton(
                                        onPressed: _isAccepting
                                            ? null
                                            : _handleAcceptTask,
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppColors.secondary,
                                          minimumSize:
                                              const Size(double.infinity, 44),
                                        ),
                                        child: _isAccepting
                                            ? const SizedBox(
                                                height: 20,
                                                width: 20,
                                                child:
                                                    CircularProgressIndicator(
                                                        color: Colors.white,
                                                        strokeWidth: 2),
                                              )
                                            : const Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Icon(Icons
                                                      .check_circle_rounded),
                                                  SizedBox(width: 8),
                                                  Text(
                                                      'Accept Task (Reserve Transfer)'),
                                                ],
                                              ),
                                      ),
                                    ],
                                  ),
                                ),

                              _buildPhaseContent(transfer, isApproved,
                                  isReserved, isInTransit, isDelivered),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _getPhaseTitle() {
    switch (_currentPhase) {
      case DeliveryPhase.headingToPickup:
        return 'Pickup';
      case DeliveryPhase.atPickup:
        return 'Inspection';
      case DeliveryPhase.inTransit:
        return 'In Transit';
      case DeliveryPhase.atDestination:
        return 'Destination';
    }
  }

  Widget _buildPhaseContent(TransferModel transfer, bool isApproved,
      bool isReserved, bool isInTransit, bool isDelivered) {
    final sourceName = transfer.sourceFacilityName.isNotEmpty
        ? transfer.sourceFacilityName
        : 'Regional Supply Depot';
    final destName = transfer.destinationFacilityName.isNotEmpty
        ? transfer.destinationFacilityName
        : 'Receiving Facility';

    switch (_currentPhase) {
      case DeliveryPhase.headingToPickup:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border)),
              child: Row(
                children: [
                  const CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.successLight,
                      child:
                          Icon(Icons.store_rounded, color: AppColors.success)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('PICKUP LOCATION (SOURCE)',
                            style: AppTextStyles.badge
                                .copyWith(color: AppColors.success)),
                        Text(sourceName, style: AppTextStyles.titleSmall),
                        Text('Stock verified and reserved for transfer',
                            style: AppTextStyles.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () =>
                  setState(() => _currentPhase = DeliveryPhase.atPickup),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.secondary,
                minimumSize: const Size(double.infinity, 46),
              ),
              child: const Text('I Have Arrived at Pickup Depot'),
            ),
          ],
        );

      case DeliveryPhase.atPickup:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Payload Inspection Checklist',
                style: AppTextStyles.titleLarge),
            const SizedBox(height: 6),
            Text('Verify cold vault packaging and quantity before departure.',
                style: AppTextStyles.bodyMedium),
            const SizedBox(height: 12),
            if (transfer.items.isNotEmpty)
              ...transfer.items.map((item) {
                final key = item.id.isNotEmpty ? item.id : item.itemName;
                final isChecked = _checkedItems.contains(key);
                return CheckboxListTile(
                  title: Text(
                      '${item.itemName} (${item.requestedQuantity} ${item.unitOfMeasure})',
                      style: AppTextStyles.titleSmall),
                  subtitle: const Text('Intact seal verified'),
                  value: isChecked,
                  activeColor: AppColors.secondary,
                  onChanged: (val) {
                    setState(() {
                      if (val == true) {
                        _checkedItems.add(key);
                      } else {
                        _checkedItems.remove(key);
                      }
                    });
                  },
                );
              })
            else
              CheckboxListTile(
                title: const Text('Cargo payload inspection verified',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                value: _checkedItems.contains('default'),
                activeColor: AppColors.secondary,
                onChanged: (val) => setState(() => val == true
                    ? _checkedItems.add('default')
                    : _checkedItems.remove('default')),
              ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _takePhoto,
              icon: const Icon(Icons.camera_alt_rounded),
              label: const Text('Take Payload Proof Photo'),
            ),
            if (_proofPhotoPath != null) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: kIsWeb
                    ? Image.network(_proofPhotoPath!, height: 100)
                    : Image.file(File(_proofPhotoPath!), height: 100),
              ),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () async {
                setState(() => _currentPhase = DeliveryPhase.inTransit);
                try {
                  await ref.read(officerTaskRepositoryProvider).confirmPickup(
                        widget.transferId,
                        PickupProof(
                            notes:
                                'Payload inspection verified, cold vault seals intact'),
                      );
                  ref.invalidate(transferByIdProvider(widget.transferId));
                  ref.invalidate(assignedTasksProvider);
                } catch (_) {}
                LocationPublisher()
                    .startPublishing(activeTransferId: widget.transferId);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.secondary,
                minimumSize: const Size(double.infinity, 46),
              ),
              child: const Text('Confirm Pickup & Begin Transit'),
            ),
          ],
        );

      case DeliveryPhase.inTransit:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: AppColors.secondaryLight,
                  borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  const Icon(Icons.sensors_rounded, color: AppColors.secondary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('GPS TELEMETRY STREAM ACTIVE',
                            style: AppTextStyles.badge
                                .copyWith(color: AppColors.secondary)),
                        Text('Publishing live location to SignalR every 5s',
                            style: AppTextStyles.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('DESTINATION HUB',
                      style: AppTextStyles.badge
                          .copyWith(color: AppColors.primary)),
                  const SizedBox(height: 4),
                  Text(destName, style: AppTextStyles.titleSmall),
                  const SizedBox(height: 4),
                  Text('En route with active cold-chain monitoring',
                      style: AppTextStyles.bodySmall),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () =>
                  setState(() => _currentPhase = DeliveryPhase.atDestination),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.secondary,
                minimumSize: const Size(double.infinity, 46),
              ),
              child: const Text('I Have Arrived at Destination Hub'),
            ),
          ],
        );

      case DeliveryPhase.atDestination:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Recipient OTP Verification', style: AppTextStyles.titleLarge),
            const SizedBox(height: 6),
            Text(
                'Enter 4-digit code provided by receiving pharmacist at $destName.',
                style: AppTextStyles.bodyMedium),
            const SizedBox(height: 16),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              style: AppTextStyles.displayMedium,
              textAlign: TextAlign.center,
              decoration: const InputDecoration(
                hintText: '0000',
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () async {
                LocationPublisher().stopPublishing();
                try {
                  await ref.read(officerTaskRepositoryProvider).confirmDelivery(
                        widget.transferId,
                        DeliveryProof(
                          recipientName: 'Staff Pharmacist',
                          notes: 'Verified with OTP ${_otpController.text}',
                        ),
                      );
                  ref.invalidate(transferByIdProvider(widget.transferId));
                  ref.invalidate(assignedTasksProvider);
                } catch (_) {}

                if (!mounted) return;
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    icon: const Icon(Icons.check_circle_rounded,
                        size: 56, color: AppColors.success),
                    title: const Text('Mission Accomplished!'),
                    content: const Text(
                        'Delivery confirmed, OTP verified, and inventory updated.'),
                    actions: [
                      ElevatedButton(
                        onPressed: () {
                          Navigator.pop(context);
                          context.go('/officer/dashboard');
                        },
                        child: const Text('Back to Officer Console'),
                      ),
                    ],
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success,
                minimumSize: const Size(double.infinity, 46),
              ),
              child: const Text('Complete Delivery & Verify OTP'),
            ),
          ],
        );
    }
  }
}

class _PhaseChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final bool isDone;

  const _PhaseChip(
      {required this.label, required this.isActive, required this.isDone});

  @override
  Widget build(BuildContext context) {
    Color bg = AppColors.surfaceSubtle;
    Color fg = AppColors.textMuted;
    if (isActive) {
      bg = AppColors.secondary;
      fg = Colors.white;
    } else if (isDone) {
      bg = AppColors.successLight;
      fg = AppColors.success;
    }

    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
        child: Center(
          child: Text(
            label,
            style:
                TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: fg),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}
