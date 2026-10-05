import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/signalr_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../auth/presentation/auth_controller.dart';
import '../tasks/incoming_task_modal.dart';

class OfficerHomeScreen extends ConsumerStatefulWidget {
  const OfficerHomeScreen({super.key});

  @override
  ConsumerState<OfficerHomeScreen> createState() => _OfficerHomeScreenState();
}

class _OfficerHomeScreenState extends ConsumerState<OfficerHomeScreen> {
  bool _isOnline = true;
  int _currentIndex = 0;
  StreamSubscription<Map<String, dynamic>>? _taskSubscription;
  final SignalRClient _signalRClient = SignalRClient();

  @override
  void initState() {
    super.initState();
    _initSignalR();
  }

  Future<void> _initSignalR() async {
    await _signalRClient.connect();
    if (_isOnline) {
      await _signalRClient.joinOfficerGroup();
    }
    _taskSubscription = _signalRClient.onTaskAssigned.listen((data) {
      if (mounted) {
        _showIncomingModal(taskData: data);
      }
    });
  }

  @override
  void dispose() {
    _taskSubscription?.cancel();
    _signalRClient.leaveOfficerGroup();
    super.dispose();
  }

  void _showIncomingModal({Map<String, dynamic>? taskData}) {
    final transferId = taskData?['id']?.toString() ?? taskData?['transferId']?.toString() ?? 'req-8842';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => IncomingTaskModal(
        onAccept: () {
          Navigator.pop(context);
          context.push('/officer/active/$transferId');
        },
        onDecline: () {
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.local_shipping_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Logistics Field Officer', style: AppTextStyles.titleMedium),
                Text('Fleet Courier Console', style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
              ],
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.secondaryLight,
              child: Text(
                user?.name.substring(0, 1) ?? 'R',
                style: AppTextStyles.badge.copyWith(color: AppColors.secondary),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ONLINE / OFFLINE TOGGLE CARD
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _isOnline ? AppColors.secondaryLight : AppColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _isOnline ? AppColors.secondary.withOpacity(0.4) : AppColors.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: _isOnline ? AppColors.success : AppColors.textMuted,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_isOnline ? 'YOU ARE ONLINE' : 'YOU ARE OFFLINE', style: AppTextStyles.titleMedium.copyWith(color: _isOnline ? AppColors.secondary : AppColors.textSecondary)),
                          Text(_isOnline ? 'Ready for priority dispatch alerts' : 'Tap switch to go online', style: AppTextStyles.bodySmall),
                        ],
                      ),
                    ],
                  ),
                  Switch.adaptive(
                    value: _isOnline,
                    activeColor: AppColors.secondary,
                    onChanged: (val) {
                      setState(() => _isOnline = val);
                      if (val) {
                        _signalRClient.joinOfficerGroup();
                      } else {
                        _signalRClient.leaveOfficerGroup();
                      }
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // TODAY'S SHIFT STATS
            Text('TODAY\'S SHIFT PERFORMANCE', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            Row(
              children: [
                _OfficerStatCard(title: 'Deliveries', value: '8', sub: 'Completed'),
                const SizedBox(width: 10),
                _OfficerStatCard(title: 'On-Time', value: '100%', sub: 'Rating 4.9★', color: AppColors.success),
                const SizedBox(width: 10),
                _OfficerStatCard(title: 'Distance', value: '42 km', sub: 'Tamil Nadu Grid'),
              ],
            ),

            const SizedBox(height: 24),

            // DEMO DISPATCH TEST TRIGGER
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('SIMULATION TOOL', style: AppTextStyles.badge.copyWith(color: AppColors.secondary)),
                      const Icon(Icons.flash_on_rounded, color: AppColors.secondary, size: 18),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Simulate Incoming Dispatch Mission', style: AppTextStyles.titleMedium),
                  const SizedBox(height: 4),
                  Text('Trigger a 30-second Uber-style cold-chain delivery assignment notification modal.', style: AppTextStyles.bodyMedium),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: _showIncomingModal,
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
                    child: const Text('Simulate Incoming Dispatch Request'),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ACTIVE DELIVERY MISSION CARD
            Text('ACTIVE MISSION', style: AppTextStyles.badge.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.secondary.withOpacity(0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('#REQ-2024-8842', style: AppTextStyles.titleSmall.copyWith(color: AppColors.secondary)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.secondaryLight, borderRadius: BorderRadius.circular(8)),
                        child: Text('IN TRANSIT', style: AppTextStyles.badge.copyWith(color: AppColors.secondary)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Insulin Glargine 100IU/ml', style: AppTextStyles.titleLarge),
                  const SizedBox(height: 2),
                  Text('Tambaram Regional Depot ➔ Apollo Anna Nagar Hub', style: AppTextStyles.bodySmall),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: () => context.push('/officer/active/req-8842'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.navigation_rounded, size: 18),
                        SizedBox(width: 8),
                        Text('Open Active Delivery Console'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: AppColors.secondary,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        onTap: (index) {
          setState(() => _currentIndex = index);
          if (index == 1) context.push('/officer/tasks');
          if (index == 2) context.push('/officer/profile');
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_rounded), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.history_rounded), label: 'Task History'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}

class _OfficerStatCard extends StatelessWidget {
  final String title;
  final String value;
  final String sub;
  final Color? color;

  const _OfficerStatCard({required this.title, required this.value, required this.sub, this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: AppTextStyles.bodySmall.copyWith(fontSize: 10)),
            const SizedBox(height: 4),
            Text(value, style: AppTextStyles.displayMedium.copyWith(fontSize: 20, color: color ?? AppColors.textPrimary)),
            const SizedBox(height: 2),
            Text(sub, style: AppTextStyles.bodySmall.copyWith(fontSize: 9)),
          ],
        ),
      ),
    );
  }
}
