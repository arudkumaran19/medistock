import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../models/transfer_models.dart';
import '../services/transfer_api_service.dart';
import 'create_transfer_screen.dart';
import 'transfer_details_screen.dart';

class TransferListScreen extends StatefulWidget {
  final TransferApiService? apiService;

  const TransferListScreen({super.key, this.apiService});

  @override
  State<TransferListScreen> createState() => _TransferListScreenState();
}

class _TransferListScreenState extends State<TransferListScreen> {
  late final TransferApiService _apiService;
  List<Transfer> _transfers = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _selectedStatusFilter = 'ALL';
  String _searchQuery = '';

  final List<String> _filters = [
    'ALL',
    'Requested',
    'Approved',
    'InTransit',
    'Delivered',
  ];

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? TransferApiService();
    _fetchTransfers();
  }

  Future<void> _fetchTransfers() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final data = await _apiService.getTransfers(
        status: _selectedStatusFilter != 'ALL' ? _selectedStatusFilter : null,
      );
      if (mounted) {
        setState(() {
          _transfers = data;
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

  List<Transfer> get _filteredTransfers {
    if (_searchQuery.isEmpty) return _transfers;
    final q = _searchQuery.toLowerCase();
    return _transfers.where((t) {
      return t.transferNumber.toLowerCase().contains(q) ||
          t.primaryMedicineName.toLowerCase().contains(q) ||
          t.destinationFacilityName.toLowerCase().contains(q) ||
          (t.sourceFacilityName != null &&
              t.sourceFacilityName!.toLowerCase().contains(q));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'MediStock Field Operations',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchTransfers,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final result = await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => CreateTransferScreen(apiService: _apiService),
            ),
          );
          if (result == true) {
            _fetchTransfers();
          }
        },
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text(
          'Declare Shortage',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Search & Filter Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            color: AppColors.surface,
            child: Column(
              children: [
                // Search Bar
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Search medicine, facility, TR-number...',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                    prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary, size: 20),
                    filled: true,
                    fillColor: AppColors.background,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                  ),
                ),

                const SizedBox(height: 10),

                // Filter Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _filters.map((f) {
                      final isSelected = _selectedStatusFilter == f;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: ChoiceChip(
                          label: Text(
                            f == 'ALL' ? 'All Operations' : f,
                            style: TextStyle(
                              color: isSelected ? Colors.white : AppColors.textSecondary,
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                          selected: isSelected,
                          selectedColor: AppColors.primary,
                          backgroundColor: AppColors.background,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                            side: BorderSide(
                              color: isSelected ? AppColors.primary : AppColors.border,
                            ),
                          ),
                          onSelected: (_) {
                            setState(() => _selectedStatusFilter = f);
                            _fetchTransfers();
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // Transfers List
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 48, color: AppColors.statusRejected),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _fetchTransfers,
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                                child: const Text('Retry'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _filteredTransfers.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.inbox_rounded, size: 54, color: AppColors.textMuted),
                                const SizedBox(height: 12),
                                Text(
                                  _searchQuery.isNotEmpty
                                      ? 'No transfers matching "$_searchQuery"'
                                      : 'No operational transfers found.',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _fetchTransfers,
                            color: AppColors.primary,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _filteredTransfers.length,
                              itemBuilder: (context, index) {
                                final transfer = _filteredTransfers[index];
                                return _buildTransferCard(transfer);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransferCard(Transfer t) {
    final statusColor = AppColors.getStatusColor(t.status);
    final priorityColor = AppColors.getPriorityColor(t.priority);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () async {
            await Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => TransferDetailsScreen(
                  transferId: t.id,
                  apiService: _apiService,
                  initialTransfer: t,
                ),
              ),
            );
            _fetchTransfers();
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Transfer #, Status, Priority
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      t.transferNumber,
                      style: const TextStyle(
                        color: AppColors.secondary,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        fontFamily: 'monospace',
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: priorityColor.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            t.priority,
                            style: TextStyle(
                              color: priorityColor,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            t.status,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // Medicine Name & Quantity
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        t.primaryMedicineName,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    Text(
                      '${t.totalAllocatedQuantity > 0 ? t.totalAllocatedQuantity : t.totalRequestedQuantity} units',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // Facility Route Row
                Row(
                  children: [
                    const Icon(Icons.arrow_forward_rounded, color: AppColors.textMuted, size: 14),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '${t.sourceFacilityName ?? "Central Store"} → ${t.destinationFacilityName}',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
