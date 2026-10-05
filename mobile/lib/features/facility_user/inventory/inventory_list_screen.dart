import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../shared/models/inventory_model.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/loading_skeleton.dart';

class InventoryListScreen extends StatefulWidget {
  const InventoryListScreen({super.key});

  @override
  State<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends State<InventoryListScreen> {
  final ApiClient _apiClient = ApiClient();
  List<InventoryModel> _items = [];
  bool _isLoading = true;
  String _searchQuery = '';
  String _filter = 'ALL'; // ALL, LOW_STOCK, EXPIRING

  @override
  void initState() {
    super.initState();
    _fetchInventory();
  }

  Future<void> _fetchInventory() async {
    setState(() => _isLoading = true);
    try {
      final data = await _apiClient.get('/api/inventory', requireAuth: false);
      if (data is List) {
        setState(() {
          _items = data.map((e) => InventoryModel.fromJson(Map<String, dynamic>.from(e as Map))).toList();
          _isLoading = false;
        });
      } else {
        _loadMockData();
      }
    } catch (_) {
      _loadMockData();
    }
  }

  void _loadMockData() {
    setState(() {
      _items = [
        InventoryModel(
          id: 'inv-1',
          itemCode: 'MED-AMX-500',
          name: 'Amoxicillin 500mg Capsules',
          category: 'Antibiotics',
          quantityAvailable: 12,
          minimumThreshold: 50,
          unitOfMeasure: 'strips',
          nextExpiryDate: DateTime.now().add(const Duration(days: 14)),
          status: 'LowStock',
        ),
        InventoryModel(
          id: 'inv-2',
          itemCode: 'MED-PAR-650',
          name: 'Paracetamol 650mg Tablets',
          category: 'Analgesic',
          quantityAvailable: 1450,
          minimumThreshold: 200,
          unitOfMeasure: 'strips',
          nextExpiryDate: DateTime.now().add(const Duration(days: 180)),
          status: 'Optimal',
        ),
        InventoryModel(
          id: 'inv-3',
          itemCode: 'MED-INS-100',
          name: 'Insulin Glargine 100IU/ml',
          category: 'Diabetes / Cold Chain',
          quantityAvailable: 8,
          minimumThreshold: 30,
          unitOfMeasure: 'vials',
          nextExpiryDate: DateTime.now().add(const Duration(days: 7)),
          status: 'Critical',
        ),
        InventoryModel(
          id: 'inv-4',
          itemCode: 'MED-CEF-200',
          name: 'Cefixime 200mg Tablets',
          category: 'Antibiotics',
          quantityAvailable: 320,
          minimumThreshold: 100,
          unitOfMeasure: 'strips',
          nextExpiryDate: DateTime.now().add(const Duration(days: 90)),
          status: 'Optimal',
        ),
      ];
      _isLoading = false;
    });
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
