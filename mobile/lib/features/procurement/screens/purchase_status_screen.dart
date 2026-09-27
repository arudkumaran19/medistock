import 'package:flutter/material.dart';
import '../models/procurement_models.dart';
import '../services/procurement_service.dart';

class PurchaseStatusScreen extends StatefulWidget {
  const PurchaseStatusScreen({super.key});

  @override
  State<PurchaseStatusScreen> createState() => _PurchaseStatusScreenState();
}

class _PurchaseStatusScreenState extends State<PurchaseStatusScreen> {
  final _procurementService = MobileProcurementService();
  List<MobilePurchaseOrder> _orders = [];
  Map<String, MobileDelivery?> _deliveries = {};
  String _selectedFilter = 'all';
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoading = true);
    try {
      final orders = await _procurementService.getPurchaseOrders();
      final deliveryEntries = await Future.wait(
        orders
            .where((o) =>
                o.status.toLowerCase() == 'approved' ||
                o.status.toLowerCase() == 'received')
            .map((o) async {
          final del = await _procurementService.getDeliveryByPurchaseOrder(o.id);
          return MapEntry(o.id, del);
        }),
      );
      if (!mounted) return;
      setState(() {
        _orders = orders;
        _deliveries = Map.fromEntries(deliveryEntries);
        _errorMessage = null;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _submitDraft(String id) async {
    try {
      await _procurementService.submitPurchaseOrder(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Order submitted for approval.')),
      );
      _loadOrders();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Submission failed: $e')),
      );
    }
  }

  Future<void> _showScheduleDeliveryDialog(MobilePurchaseOrder order) async {
    final trackingCtrl = TextEditingController(text: 'TRK-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}');
    final notesCtrl = TextEditingController(text: 'Cold chain verified delivery');

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Schedule Delivery (PO-${order.id.substring(0, 8)})'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: trackingCtrl,
              decoration: const InputDecoration(labelText: 'Tracking Number'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesCtrl,
              decoration: const InputDecoration(labelText: 'Carrier Notes'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Schedule')),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _procurementService.createDelivery(
          order.id,
          expectedAt: DateTime.now().add(const Duration(days: 3)),
          trackingNumber: trackingCtrl.text.trim(),
          notes: notesCtrl.text.trim(),
        );
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Delivery scheduled successfully.')),
        );
        _loadOrders();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Scheduling failed: $e')),
        );
      }
    }
  }

  Future<void> _showDeliverDialog(MobilePurchaseOrder order, MobileDelivery delivery) async {
    final batchCtrl = TextEditingController(text: 'BATCH-001');

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Receive Goods into Inventory (PO-${order.id.substring(0, 8)})'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Items to receive: ${order.items.length} items (${order.totalQuantity} total units)'),
            const SizedBox(height: 12),
            TextField(
              controller: batchCtrl,
              decoration: const InputDecoration(
                labelText: 'Batch Number (BATCH-###)',
                hintText: 'BATCH-001',
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Delivering this purchase order will immediately increment facility inventory balances and record warehouse receipts.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.green.shade800),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirm & Receive Stock'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final batchNo = batchCtrl.text.trim();
      final now = DateTime.now();
      final oneYear = now.add(const Duration(days: 365));

      final itemsPayload = order.items.map((it) => {
        'medicineId': it.medicineId,
        'quantity': it.requestedQuantity,
        'batchNumber': batchNo,
        'expiryDateUtc': oneYear.toUtc().toIso8601String(),
        'manufacturingDateUtc': now.toUtc().toIso8601String(),
      }).toList();

      try {
        await _procurementService.markDelivered(delivery.id, itemsPayload);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delivery confirmed! Inventory balances and stock batches have been updated.'),
            backgroundColor: Color(0xff17634d),
          ),
        );
        _loadOrders();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delivery confirmation failed: $e')),
        );
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'received':
        return Colors.teal.shade800;
      case 'approved':
        return Colors.green.shade700;
      case 'pendingapproval':
        return Colors.amber.shade800;
      case 'rejected':
        return Colors.red.shade700;
      case 'revisionrequired':
        return Colors.orange.shade800;
      default:
        return Colors.grey.shade700;
    }
  }

  List<MobilePurchaseOrder> get _filteredOrders {
    if (_selectedFilter == 'all') return _orders;
    return _orders
        .where((o) => o.status.toLowerCase() == _selectedFilter.toLowerCase())
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Purchase Orders'),
        backgroundColor: const Color(0xff17634d),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'New Requisition',
            onPressed: () => Navigator.pushNamed(context, '/procurement/request'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadOrders,
          ),
        ],
      ),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                _buildFilterChip('all', 'All (${_orders.length})'),
                _buildFilterChip('pendingapproval', 'Pending'),
                _buildFilterChip('approved', 'Approved'),
                _buildFilterChip('received', 'Received'),
                _buildFilterChip('draft', 'Drafts'),
                _buildFilterChip('rejected', 'Rejected'),
              ],
            ),
          ),
          if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade800)),
            ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredOrders.isEmpty
                    ? Center(
                        child: Text(
                          'No purchase orders in this view.',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadOrders,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _filteredOrders.length,
                          itemBuilder: (context, index) {
                            final order = _filteredOrders[index];
                            final color = _getStatusColor(order.status);
                            final totalCost = order.totalEstimatedCost;
                            final delivery = _deliveries[order.id];

                            return Card(
                              elevation: 0,
                              margin: const EdgeInsets.only(bottom: 12),
                              shape: RoundedRectangleBorder(
                                side: BorderSide(color: Colors.grey.shade300),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'PO-${order.id.substring(0, 8)}',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: color.withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: color.withOpacity(0.4)),
                                          ),
                                          child: Text(
                                            order.status,
                                            style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      '${order.items.length} item(s) • Total: \$${totalCost.toStringAsFixed(2)}',
                                      style: TextStyle(color: Colors.grey.shade800, fontSize: 14),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Requested: ${order.requestedAt.toLocal().toString().split(' ')[0]}',
                                      style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                                    ),
                                    if (delivery != null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 6),
                                        child: Text(
                                          'Delivery: ${delivery.status} (Track: ${delivery.trackingNumber ?? "N/A"})',
                                          style: TextStyle(
                                            color: delivery.status == 'Delivered'
                                                ? Colors.teal.shade800
                                                : Colors.blue.shade800,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    if (order.rejectionReason != null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 6),
                                        child: Text(
                                          'Rejection: ${order.rejectionReason}',
                                          style: TextStyle(color: Colors.red.shade800, fontSize: 12),
                                        ),
                                      ),
                                    if (order.revisionReason != null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 6),
                                        child: Text(
                                          'Revision: ${order.revisionReason}',
                                          style: TextStyle(color: Colors.orange.shade900, fontSize: 12),
                                        ),
                                      ),
                                    if (order.status.toLowerCase() == 'draft' ||
                                        order.status.toLowerCase() == 'revisionrequired')
                                      Padding(
                                        padding: const EdgeInsets.only(top: 12),
                                        child: SizedBox(
                                          width: double.infinity,
                                          child: OutlinedButton(
                                            onPressed: () => _submitDraft(order.id),
                                            child: const Text('Submit for Approval'),
                                          ),
                                        ),
                                      ),
                                    if (order.status.toLowerCase() == 'approved' && delivery == null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 12),
                                        child: SizedBox(
                                          width: double.infinity,
                                          child: FilledButton.icon(
                                            style: FilledButton.styleFrom(backgroundColor: const Color(0xff0f766e)),
                                            icon: const Icon(Icons.local_shipping, size: 18),
                                            label: const Text('Schedule Delivery'),
                                            onPressed: () => _showScheduleDeliveryDialog(order),
                                          ),
                                        ),
                                      ),
                                    if (order.status.toLowerCase() == 'approved' &&
                                        delivery != null &&
                                        delivery.status.toLowerCase() != 'delivered')
                                      Padding(
                                        padding: const EdgeInsets.only(top: 12),
                                        child: SizedBox(
                                          width: double.infinity,
                                          child: FilledButton.icon(
                                            style: FilledButton.styleFrom(backgroundColor: const Color(0xff1d4ed8)),
                                            icon: const Icon(Icons.inventory, size: 18),
                                            label: const Text('Mark Delivered (Receive Stock)'),
                                            onPressed: () => _showDeliverDialog(order, delivery),
                                          ),
                                        ),
                                      ),
                                    if (order.status.toLowerCase() == 'received' ||
                                        (delivery != null && delivery.status.toLowerCase() == 'delivered'))
                                      Padding(
                                        padding: const EdgeInsets.only(top: 10),
                                        child: Row(
                                          children: [
                                            Icon(Icons.check_circle, size: 16, color: Colors.teal.shade700),
                                            const SizedBox(width: 6),
                                            Text(
                                              'Goods received into facility inventory',
                                              style: TextStyle(color: Colors.teal.shade800, fontSize: 12, fontWeight: FontWeight.w600),
                                            ),
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _selectedFilter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => setState(() => _selectedFilter = key),
        selectedColor: const Color(0xff17634d).withOpacity(0.15),
        checkmarkColor: const Color(0xff17634d),
        labelStyle: TextStyle(
          color: isSelected ? const Color(0xff17634d) : Colors.grey.shade700,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }
}
