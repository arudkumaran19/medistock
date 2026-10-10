import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/status_chip.dart';

class RequestListScreen extends StatefulWidget {
  const RequestListScreen({super.key});

  @override
  State<RequestListScreen> createState() => _RequestListScreenState();
}

class _RequestListScreenState extends State<RequestListScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Facility Medicine Requisitions'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'All (18)'),
            Tab(text: 'In Transit (2)'),
            Tab(text: 'Approved (4)'),
            Tab(text: 'Pending (3)'),
            Tab(text: 'Delivered (9)'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildRequestList(filterStatus: 'ALL'),
          _buildRequestList(filterStatus: 'INTRANSIT'),
          _buildRequestList(filterStatus: 'APPROVED'),
          _buildRequestList(filterStatus: 'PENDING'),
          _buildRequestList(filterStatus: 'DELIVERED'),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/user/requests/new'),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('New Requisition', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _buildRequestList({required String filterStatus}) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _RequestTile(
          id: '#REQ-2024-8842',
          medicine: 'Insulin Glargine 100IU/ml & Cefixime',
          details: '120 strips • Cold-Chain Tracked',
          route: 'Tambaram Regional Depot ➔ Apollo Anna Nagar',
          status: 'INTRANSIT',
          onTap: () => context.push('/user/requests/req-8842'),
        ),
        const SizedBox(height: 12),
        _RequestTile(
          id: '#REQ-2024-8839',
          medicine: 'Human Albumin 20%',
          details: '15 vials (100ml) • Cold storage',
          route: 'Kilpauk Medical Depot ➔ Apollo Anna Nagar',
          status: 'APPROVED',
          onTap: () => context.push('/user/requests/req-8839'),
        ),
        const SizedBox(height: 12),
        _RequestTile(
          id: '#REQ-2024-8810',
          medicine: 'Paracetamol 650mg Tablets',
          details: '500 strips • Verified via barcode scan',
          route: 'MedPlus Guindy Hub ➔ Apollo Anna Nagar',
          status: 'DELIVERED',
          onTap: () => context.push('/user/requests/req-8810'),
        ),
      ],
    );
  }
}

class _RequestTile extends StatelessWidget {
  final String id;
  final String medicine;
  final String details;
  final String route;
  final String status;
  final VoidCallback onTap;

  const _RequestTile({
    required this.id,
    required this.medicine,
    required this.details,
    required this.route,
    required this.status,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
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
                Text(id, style: AppTextStyles.titleSmall.copyWith(color: AppColors.primaryDark)),
                StatusChip(status: status),
              ],
            ),
            const SizedBox(height: 8),
            Text(medicine, style: AppTextStyles.titleMedium),
            const SizedBox(height: 2),
            Text(details, style: AppTextStyles.bodySmall),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.navigation_outlined, size: 14, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(child: Text(route, style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
