import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/widgets/state_views.dart';
import '../../../shared/widgets/status_chip.dart';
import 'data/officer_task_repository.dart';

String toBackendStatus(String uiStatus) {
  const map = {
    'InTransit': 'Dispatched',
    'Delivered': 'Received',
    'Pending': 'Requested',
  };
  return map[uiStatus] ?? uiStatus;
}

class TaskHistoryScreen extends ConsumerStatefulWidget {
  const TaskHistoryScreen({super.key});

  @override
  ConsumerState<TaskHistoryScreen> createState() => _TaskHistoryScreenState();
}

class _TaskHistoryScreenState extends ConsumerState<TaskHistoryScreen> {
  String _selectedStatusFilter = 'ALL';
  static const List<String> _filters = ['ALL', 'InTransit', 'Delivered', 'Assigned'];

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(assignedTasksProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Officer Delivery History'),
      ),
      body: tasksAsync.when(
        loading: () => const LoadingView(label: 'Loading tasks...'),
        error: (err, _) => ErrorView(
          message: 'Failed to load task history: $err',
          onRetry: () => ref.refresh(assignedTasksProvider),
        ),
        data: (tasks) {
          final filteredTasks = _selectedStatusFilter == 'ALL'
              ? tasks
              : tasks.where((t) {
                  final target = toBackendStatus(_selectedStatusFilter).toLowerCase();
                  final current = toBackendStatus(t.status).toLowerCase();
                  return current == target;
                }).toList();

          return Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: _filters.map((f) {
                    final isSelected = _selectedStatusFilter == f;
                    final label = f == 'ALL'
                        ? 'All'
                        : f == 'InTransit'
                            ? 'In Transit'
                            : f;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: ChoiceChip(
                        label: Text(
                          label,
                          style: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textSecondary,
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        selected: isSelected,
                        selectedColor: AppColors.primary,
                        backgroundColor: AppColors.surface,
                        onSelected: (_) => setState(() => _selectedStatusFilter = f),
                      ),
                    );
                  }).toList(),
                ),
              ),
              Expanded(
                child: filteredTasks.isEmpty
                    ? RefreshIndicator(
                        onRefresh: () async => ref.refresh(assignedTasksProvider),
                        child: ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [
                            SizedBox(height: 80),
                            EmptyView(message: 'No deliveries found in this category'),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () async => ref.refresh(assignedTasksProvider),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredTasks.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final task = filteredTasks[index];
                            final medicineTitle = task.items.isNotEmpty
                                ? task.items.map((i) => '${i.itemName} (${i.requestedQuantity})').join(', ')
                                : 'Transfer #${task.transferNumber}';
                            final route = '${task.sourceFacilityName} ➔ ${task.destinationFacilityName}';
                            final dateStr = '${task.createdAt.day}/${task.createdAt.month}/${task.createdAt.year}';

                            return InkWell(
                              onTap: () => context.push('/officer/active/${task.id}'),
                              borderRadius: BorderRadius.circular(16),
                              child: _HistoryCard(
                                id: '#${task.transferNumber}',
                                medicine: medicineTitle,
                                route: route,
                                date: dateStr,
                                status: task.status,
                                distance: 'Live Tracked',
                              ),
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final String id;
  final String medicine;
  final String route;
  final String date;
  final String status;
  final String distance;

  const _HistoryCard({
    required this.id,
    required this.medicine,
    required this.route,
    required this.date,
    required this.status,
    required this.distance,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
              Text(id, style: AppTextStyles.titleSmall.copyWith(color: AppColors.secondary)),
              StatusChip(status: status.toUpperCase()),
            ],
          ),
          const SizedBox(height: 8),
          Text(medicine, style: AppTextStyles.titleMedium),
          const SizedBox(height: 4),
          Text(route, style: AppTextStyles.bodySmall),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(date, style: AppTextStyles.bodySmall),
              Text(distance, style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }
}
