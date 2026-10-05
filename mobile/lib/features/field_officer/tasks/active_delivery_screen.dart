import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

enum DeliveryPhase { headingToPickup, atPickup, inTransit, atDestination }

class ActiveDeliveryScreen extends StatefulWidget {
  final String transferId;

  const ActiveDeliveryScreen({super.key, required this.transferId});

  @override
  State<ActiveDeliveryScreen> createState() => _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends State<ActiveDeliveryScreen> {
  DeliveryPhase _currentPhase = DeliveryPhase.headingToPickup;

  // Phase B Checklist
  bool _item1Checked = true;
  bool _item2Checked = true;

  // Phase D OTP
  final TextEditingController _otpController = TextEditingController(text: '4829');

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_getPhaseTitle()),
        actions: [
          IconButton(
            icon: const Icon(Icons.warning_amber_rounded, color: AppColors.error),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Dispatched issue report to District Supply Command!')),
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
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: AppColors.surface,
              child: Row(
                children: [
                  _PhaseChip(label: '1. Heading to Pickup', isActive: _currentPhase == DeliveryPhase.headingToPickup, isDone: _currentPhase.index > 0),
                  _PhaseChip(label: '2. At Pickup', isActive: _currentPhase == DeliveryPhase.atPickup, isDone: _currentPhase.index > 1),
                  _PhaseChip(label: '3. In Transit', isActive: _currentPhase == DeliveryPhase.inTransit, isDone: _currentPhase.index > 2),
                  _PhaseChip(label: '4. Destination', isActive: _currentPhase == DeliveryPhase.atDestination, isDone: false),
                ],
              ),
            ),

            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    // Map View
                    SizedBox(
                      height: 240,
                      child: FlutterMap(
                        options: MapOptions(
                          initialCenter: const LatLng(13.0450, 80.2050),
                          initialZoom: 12.8,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.medistock.app',
                          ),
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: const [
                                  LatLng(13.0125, 80.1982),
                                  LatLng(13.0450, 80.2050),
                                  LatLng(13.0827, 80.2707),
                                ],
                                strokeWidth: 5,
                                color: AppColors.secondary,
                              ),
                            ],
                          ),
                          MarkerLayer(
                            markers: const [
                              Marker(
                                point: LatLng(13.0125, 80.1982),
                                child: Icon(Icons.store_rounded, color: AppColors.success, size: 30),
                              ),
                              Marker(
                                point: LatLng(13.0827, 80.2707),
                                child: Icon(Icons.local_hospital_rounded, color: AppColors.error, size: 30),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: _buildPhaseContent(),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getPhaseTitle() {
    switch (_currentPhase) {
      case DeliveryPhase.headingToPickup:
        return 'Phase A: Heading to Pickup';
      case DeliveryPhase.atPickup:
        return 'Phase B: At Pickup & Inspection';
      case DeliveryPhase.inTransit:
        return 'Phase C: In Transit to Destination';
      case DeliveryPhase.atDestination:
        return 'Phase D: Delivery & Verification';
    }
  }

  Widget _buildPhaseContent() {
    switch (_currentPhase) {
      case DeliveryPhase.headingToPickup:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
              child: Row(
                children: [
                  const CircleAvatar(radius: 20, backgroundColor: AppColors.successLight, child: Icon(Icons.store_rounded, color: AppColors.success)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('PICKUP LOCATION', style: AppTextStyles.badge.copyWith(color: AppColors.success)),
                        Text('Kilpauk Medical Depot, Bay 4', style: AppTextStyles.titleSmall),
                        Text('3.2 km away • Estimated 8 mins drive', style: AppTextStyles.bodySmall),
                      ],
                    ),
                  ),
                  IconButton(icon: const Icon(Icons.phone_rounded, color: AppColors.secondary), onPressed: () {}),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => setState(() => _currentPhase = DeliveryPhase.atPickup),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
              child: const Text('I Have Arrived at Pickup Depot'),
            ),
          ],
        );

      case DeliveryPhase.atPickup:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Payload Inspection Checklist', style: AppTextStyles.titleLarge),
            const SizedBox(height: 12),
            CheckboxListTile(
              title: Text('Insulin Glargine 100IU/ml (8 vials)', style: AppTextStyles.titleSmall),
              subtitle: const Text('Batch #INS-908 • Seals Intact'),
              value: _item1Checked,
              activeColor: AppColors.secondary,
              onChanged: (val) => setState(() => _item1Checked = val!),
            ),
            CheckboxListTile(
              title: Text('Meropenem 1g IV (20 vials)', style: AppTextStyles.titleSmall),
              subtitle: const Text('Batch #MER-112 • Cold Vault Verified'),
              value: _item2Checked,
              activeColor: AppColors.secondary,
              onChanged: (val) => setState(() => _item2Checked = val!),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.camera_alt_rounded),
              label: const Text('Take Payload Proof Photo'),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => setState(() => _currentPhase = DeliveryPhase.inTransit),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
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
              decoration: BoxDecoration(color: AppColors.secondaryLight, borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  const Icon(Icons.sensors_rounded, color: AppColors.secondary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('GPS TELEMETRY STREAM ACTIVE', style: AppTextStyles.badge.copyWith(color: AppColors.secondary)),
                        Text('Publishing live location to SignalR every 5s', style: AppTextStyles.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => setState(() => _currentPhase = DeliveryPhase.atDestination),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
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
            Text('Enter 4-digit code provided by receiving pharmacist.', style: AppTextStyles.bodyMedium),
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
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    icon: const Icon(Icons.check_circle_rounded, size: 56, color: AppColors.success),
                    title: const Text('Mission Accomplished!'),
                    content: const Text('Delivery confirmed, OTP verified, and inventory updated.'),
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
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
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

  const _PhaseChip({required this.label, required this.isActive, required this.isDone});

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
        padding: const EdgeInsets.symmetric(vertical: 4),
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
        child: Center(
          child: Text(
            label,
            style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: fg),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}
