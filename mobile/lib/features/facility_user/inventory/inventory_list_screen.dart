import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/models/inventory_model.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/loading_skeleton.dart';
import 'data/inventory_repository.dart';

class InventoryListScreen extends ConsumerStatefulWidget {
  const InventoryListScreen({super.key});

  @override
  ConsumerState<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends ConsumerState<InventoryListScreen> {
  List<InventoryModel> _items = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _searchQuery = '';
  String _filter = 'ALL'; // ALL, LOW_STOCK, EXPIRING

  @override
  void initState() {
    super.initState();
    _fetchInventory();
  }

  Future<void> _fetchInventory() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final items = await ref.read(inventoryRepositoryProvider).getAll();
      if (mounted) {
        setState(() {
          _items = items;
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

  List<InventoryModel> get _filteredItems {
    return _items.where((item) {
      final matchesSearch = item.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          item.itemCode.toLowerCase().contains(_searchQuery.toLowerCase());
      if (_filter == 'LOW_STOCK') return matchesSearch && item.isLowStock;
      if (_filter == 'EXPIRING') return matchesSearch && item.nextExpiryDate != null && item.nextExpiryDate!.difference(DateTime.now()).inDays <= 30;
      return matchesSearch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Facility Inventory Audit'),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchInventory,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              // Search Input
              TextField(
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded),
                  hintText: 'Search medicine name, code, or batch...',
                ),
                onChanged: (val) => setState(() => _searchQuery = val),
              ),

              const SizedBox(height: 12),

              // Filter Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _FilterChip(
                      label: 'All Items (${_items.length})',
                      isSelected: _filter == 'ALL',
                      onTap: () => setState(() => _filter = 'ALL'),
                    ),
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: 'Low Stock Warnings',
                      isSelected: _filter == 'LOW_STOCK',
                      color: AppColors.error,
                      onTap: () => setState(() => _filter = 'LOW_STOCK'),
                    ),
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: 'Expiring Soon (30d)',
                      isSelected: _filter == 'EXPIRING',
                      color: AppColors.warning,
                      onTap: () => setState(() => _filter = 'EXPIRING'),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Content List
              Expanded(
                child: _isLoading
                    ? ListView.separated(
                        itemCount: 5,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, __) => const LoadingSkeleton(height: 90),
                      )
                    : _errorMessage != null
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text('Failed to load inventory: $_errorMessage', textAlign: TextAlign.center),
                                const SizedBox(height: 12),
                                ElevatedButton(
                                  onPressed: _fetchInventory,
                                  child: const Text('Retry'),
                                ),
                              ],
                            ),
                          )
                        : _filteredItems.isEmpty
                            ? const EmptyStateWidget(
                                title: 'No Inventory Items Found',
                                message: 'Try adjusting your search criteria or filter chips.',
                              )
                            : ListView.separated(
                                itemCount: _filteredItems.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 12),
                                itemBuilder: (context, index) {
                                  final item = _filteredItems[index];
                                  return _InventoryCard(item: item);
                                },
                              ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = color ?? AppColors.primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? activeColor : AppColors.border),
        ),
        child: Text(
          label,
          style: AppTextStyles.bodySmall.copyWith(
            color: isSelected ? Colors.white : AppColors.textPrimary,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _InventoryCard extends StatelessWidget {
  final InventoryModel item;

  const _InventoryCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final daysToExpiry = item.nextExpiryDate != null ? item.nextExpiryDate!.difference(DateTime.now()).inDays : 999;
    final isExpiring = daysToExpiry <= 30;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: item.isLowStock ? AppColors.error.withOpacity(0.4) : AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: item.isLowStock ? AppColors.errorLight : AppColors.primarySurface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.medication_rounded,
              color: item.isLowStock ? AppColors.error : AppColors.primary,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(item.itemCode, style: AppTextStyles.badge.copyWith(color: AppColors.textMuted)),
                    const SizedBox(width: 6),
                    Text('• ${item.category}', style: AppTextStyles.bodySmall),
                  ],
                ),
                const SizedBox(height: 2),
                Text(item.name, style: AppTextStyles.titleSmall),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Text(
                      'Qty: ${item.quantityAvailable} ${item.unitOfMeasure}',
                      style: AppTextStyles.bodyMedium.copyWith(
                        fontWeight: FontWeight.bold,
                        color: item.isLowStock ? AppColors.error : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    if (isExpiring)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.warningLight,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Exp: ${daysToExpiry}d',
                          style: AppTextStyles.badge.copyWith(color: AppColors.warning),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
