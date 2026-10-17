import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/state_views.dart';
import '../../../shared/widgets/status_chip.dart';
import 'data/transfer_repository.dart';

String toBackendStatus(String uiStatus) {
  const map = {
    'InTransit': 'Dispatched',
    'Delivered': 'Received',
    'Pending': 'Requested',
  };
  return map[uiStatus] ?? uiStatus;
}

class RequestListScreen extends ConsumerStatefulWidget {
  const RequestListScreen({super.key});

  @override
  ConsumerState<RequestListScreen> createState() => _RequestListScreenState();
}

class _RequestListScreenState extends ConsumerState<RequestListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const List<Map<String, String?>> _tabs = [
    {'label': 'All', 'status': null},
    {'label': 'In Transit', 'status': 'InTransit'},
    {'label': 'Approved', 'status': 'Approved'},
    {'label': 'Pending', 'status': 'Pending'},
    {'label': 'Delivered', 'status': 'Delivered'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
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
          tabs: _tabs.map((tab) => Tab(text: tab['label'])).toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: _tabs
            .map((tab) => _buildRequestList(status: tab['status']))
            .toList(),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push('/user/requests/new');
          if (mounted) {
            ref.invalidate(myRequestsProvider);
          }
        },
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('New Requisition',
            style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _buildRequestList({String? status}) {
    final backendStatus = status != null ? toBackendStatus(status) : null;
    final requestsAsync = ref.watch(myRequestsProvider(backendStatus));

    return requestsAsync.when(
      loading: () => const LoadingView(label: 'Loading requisitions...'),
      error: (err, _) => ErrorView(
        message: 'Failed to load requests: $err',
        onRetry: () => ref.refresh(myRequestsProvider(backendStatus)),
      ),
      data: (items) {
        if (items.isEmpty) {
          return RefreshIndicator(
            onRefresh: () async =>
                ref.refresh(myRequestsProvider(backendStatus)),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 120),
                EmptyView(message: 'No requisitions found in this view'),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.refresh(myRequestsProvider(status)),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = items[index];
              final medicineTitle = item.items.isNotEmpty
                  ? item.items
                      .map((i) => '${i.itemName} (${i.requestedQuantity})')
                      .join(', ')
                  : 'Requisition #${item.transferNumber}';
              final totalUnits = item.items
                  .fold<int>(0, (sum, i) => sum + i.requestedQuantity);
              final details = totalUnits > 0
                  ? '$totalUnits ${item.primaryUnitOfMeasure} • Priority: ${item.priority}'
                  : 'Priority: ${item.priority}';
              final route =
                  '${item.sourceFacilityName} ➔ ${item.destinationFacilityName}';

              return _RequestTile(
                id: '#${item.transferNumber}',
                medicine: medicineTitle,
                details: details,
                route: route,
                status: item.status.toUpperCase(),
                onTap: () => context.push('/user/requests/${item.id}'),
              );
            },
          ),
        );
      },
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
                Text(id,
                    style: AppTextStyles.titleSmall
                        .copyWith(color: AppColors.primaryDark)),
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
                const Icon(Icons.navigation_outlined,
                    size: 14, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(
                    child: Text(route,
                        style: AppTextStyles.bodySmall
                            .copyWith(color: AppColors.textPrimary))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
