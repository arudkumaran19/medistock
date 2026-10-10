import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/network/signalr_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

class RequestDetailScreen extends StatefulWidget {
  final String requestId;

  const RequestDetailScreen({super.key, required this.requestId});

  @override
  State<RequestDetailScreen> createState() => _RequestDetailScreenState();
}

class _RequestDetailScreenState extends State<RequestDetailScreen> {
  final SignalRClient _signalRClient = SignalRClient();
  LatLng _vehiclePos = const LatLng(13.0450, 80.2050); // Animated position along Chennai corridor
  double _coreTemp = 4.2;

  @override
  void initState() {
    super.initState();
    _connectSignalR();
  }

  void _connectSignalR() async {
    await _signalRClient.connect();
    await _signalRClient.joinTransferGroup(widget.requestId);

    _signalRClient.onTransferLocationUpdated.listen((data) {
      if (mounted && data['latitude'] != null && data['longitude'] != null) {
        setState(() {
          _vehiclePos = LatLng((data['latitude'] as num).toDouble(), (data['longitude'] as num).toDouble());
        });
      }
    });
  }

  @override
  void dispose() {
    _signalRClient.leaveTransferGroup(widget.requestId);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('REQ-2024-8842', style: AppTextStyles.titleSmall),
            Text('Critical Insulin & Cold-Chain', style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: AppColors.warningLight, borderRadius: BorderRadius.circular(8)),
            child: Text('Urgent Cold-Chain', style: AppTextStyles.badge.copyWith(color: AppColors.warning)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Live Interactive Map View
            SizedBox(
              height: 260,
              child: Stack(
                children: [
                  FlutterMap(
                    options: MapOptions(
                      initialCenter: const LatLng(13.0500, 80.2100),
                      initialZoom: 12.5,
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
                              LatLng(13.0125, 80.1982), // Tambaram Depot
                              LatLng(13.0450, 80.2050), // Koyambedu Corridors
                              LatLng(13.0827, 80.2707), // Apollo Anna Nagar
                            ],
                            strokeWidth: 4.5,
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                      MarkerLayer(
                        markers: [
                          const Marker(
                            point: LatLng(13.0125, 80.1982),
                            child: Icon(Icons.store_rounded, color: AppColors.success, size: 28),
                          ),
                          Marker(
                            point: _vehiclePos,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                              child: const Icon(Icons.local_shipping_rounded, color: Colors.white, size: 20),
                            ),
                          ),
                          const Marker(
                            point: LatLng(13.0827, 80.2707),
                            child: Icon(Icons.local_hospital_rounded, color: AppColors.error, size: 28),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6)],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.speed_rounded, size: 14, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text('24 mins ETA • 3.8 km away', style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Officer Contact Card
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
                          radius: 22,
                          backgroundColor: AppColors.secondaryLight,
                          child: Icon(Icons.person_rounded, color: AppColors.secondary),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Rajesh Kumar (Officer)', style: AppTextStyles.titleSmall),
                              Text('Vehicle: TN-09-CB-4491 • Cryo-Pod 302', style: AppTextStyles.bodySmall),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.phone_rounded, color: AppColors.primary),
                          onPressed: () {},
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // COLD-CHAIN TELEMETRY CARD
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.primaryLight.withOpacity(0.4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Active Cold-Chain Telemetry', style: AppTextStyles.titleSmall.copyWith(color: AppColors.primaryDark)),
                            Text('Live Sync: 4s ago', style: AppTextStyles.bodySmall),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            _TelemetryBox(label: 'Core Temp', value: '${_coreTemp}°C', sub: 'Optimal 2°-8°C', color: AppColors.success),
                            const SizedBox(width: 8),
                            const _TelemetryBox(label: 'Humidity', value: '45%', sub: 'Safe Range (RH)', color: AppColors.primary),
                            const SizedBox(width: 8),
                            const _TelemetryBox(label: 'Vibration', value: '0.12g', sub: 'Shock: Normal', color: AppColors.secondary),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // RECIPIENT VERIFICATION OTP
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Recipient Verification OTP', style: AppTextStyles.titleSmall),
                            Text('Provide upon courier arrival', style: AppTextStyles.bodySmall),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: const [
                            _OtpBox(digit: '4'),
                            _OtpBox(digit: '8'),
                            _OtpBox(digit: '2'),
                            _OtpBox(digit: '9'),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text('Encrypted Handshake • Single-Use Medical Chain Token', style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // CHAIN OF CUSTODY TIMELINE
                  Text('Chain of Custody', style: AppTextStyles.titleLarge),
                  const SizedBox(height: 12),
                  const _CustodyItem(title: 'Requisition Submitted', time: '08:30 AM', desc: 'Signed by Apollo Pharmacy Anna Nagar (ID: EXP-408)', isDone: true),
                  const _CustodyItem(title: 'Tambaram Depot Admin Approval', time: '08:45 AM', desc: 'Cold vault release authorized by Dr. S. Ramanathan', isDone: true),
                  const _CustodyItem(title: 'Dispatched to Field Officer', time: '09:10 AM', desc: 'Rajesh Kumar (EPO-88) accepted priority dispatch', isDone: true),
                  const _CustodyItem(title: 'Cargo Verified & Sealed', time: '09:30 AM', desc: 'Batch #AMX0-2024-09 locked in Cryo-Pod 302', isDone: true),
                  const _CustodyItem(title: 'In Transit — Moving Corridors', time: '09:52 AM', desc: 'Passing Koyambedu Junction towards 100 Feet Rd', isDone: true, isCurrent: true),
                  const _CustodyItem(title: 'Arrival at Facility Bay 2', time: '10:16 AM (ETA)', desc: 'Staging area notified for sterile intake transfer', isDone: false),
                  const _CustodyItem(title: 'Delivered & OTP Handshake', time: 'Pending', desc: 'Biometric signature & temperature validation report', isDone: false),

                  const SizedBox(height: 28),

                  ElevatedButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Delivery Confirmed & Stock Automatically Updated in Inventory!')),
                      );
                    },
                    child: const Text('Confirm Goods Receipt (Unlock Geofence)'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TelemetryBox extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final Color color;

  const _TelemetryBox({required this.label, required this.value, required this.sub, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
        child: Column(
          children: [
            Text(label, style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
            const SizedBox(height: 2),
            Text(value, style: AppTextStyles.titleMedium.copyWith(color: color, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(sub, style: AppTextStyles.bodySmall.copyWith(fontSize: 9)),
          ],
        ),
      ),
    );
  }
}

class _OtpBox extends StatelessWidget {
  final String digit;

  const _OtpBox({required this.digit});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 52,
      decoration: BoxDecoration(
        color: AppColors.primarySurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.primary),
      ),
      child: Center(
        child: Text(digit, style: AppTextStyles.displayMedium.copyWith(color: AppColors.primaryDark)),
      ),
    );
  }
}

class _CustodyItem extends StatelessWidget {
  final String title;
  final String time;
  final String desc;
  final bool isDone;
  final bool isCurrent;

  const _CustodyItem({
    required this.title,
    required this.time,
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
              isDone ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
              size: 20,
              color: isDone ? (isCurrent ? AppColors.secondary : AppColors.success) : AppColors.textMuted,
            ),
            Container(width: 2, height: 40, color: isDone ? AppColors.success : AppColors.border),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(title, style: AppTextStyles.titleSmall.copyWith(color: isCurrent ? AppColors.secondary : AppColors.textPrimary)),
                  Text(time, style: AppTextStyles.bodySmall),
                ],
              ),
              const SizedBox(height: 2),
              Text(desc, style: AppTextStyles.bodyMedium),
              const SizedBox(height: 14),
            ],
          ),
        ),
      ],
    );
  }
}
