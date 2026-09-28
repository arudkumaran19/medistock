import 'package:flutter/material.dart';
import '../models/procurement_models.dart';
import '../services/procurement_service.dart';

class ApprovalStatusScreen extends StatefulWidget {
  const ApprovalStatusScreen({super.key});

  @override
  State<ApprovalStatusScreen> createState() => _ApprovalStatusScreenState();
}

class _ApprovalStatusScreenState extends State<ApprovalStatusScreen> {
  final _procurementService = MobileProcurementService();
  List<MobilePurchaseOrder> _pendingOrders = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadPending();
  }

  Future<void> _loadPending() async {
    setState(() => _isLoading = true);
    try {
      final orders = await _procurementService.getPendingApprovals();
      if (!mounted) return;
      setState(() {
        _pendingOrders = orders;
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

  Future<void> _approveOrder(String id) async {
    try {
      await _procurementService.approvePurchaseOrder(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Order approved successfully.')),
      );
      _loadPending();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Approval failed: $e')),
      );
    }
  }

  void _showReasonModal(MobilePurchaseOrder order, bool isRevision) {
    final reasonController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isRevision ? 'Request Revision' : 'Reject Purchase Order',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Specify the audit reason for order PO-${order.id.substring(0, 8)}…',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: isRevision
                      ? 'e.g. Reduce quantity to 150 units.'
                      : 'e.g. Budget exceeded for current quarter.',
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: isRevision ? Colors.orange.shade800 : Colors.red.shade700,
                    ),
                    onPressed: () async {
                      final reason = reasonController.text.trim();
                      if (reason.isEmpty) return;
                      Navigator.pop(ctx);
                      try {
                        if (isRevision) {
                          await _procurementService.requestRevision(order.id, reason);
                        } else {
                          await _procurementService.rejectPurchaseOrder(order.id, reason);
                        }
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                isRevision ? 'Revision requested.' : 'Order rejected.',
                              ),
                            ),
                          );
                          _loadPending();
                        }
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Action failed: $e')),
                          );
                        }
                      }
                    },
                    child: Text(isRevision ? 'Request Revision' : 'Confirm Rejection'),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Managerial Approvals'),
        backgroundColor: const Color(0xff17634d),
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadPending),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)))
              : _pendingOrders.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 64, color: Colors.green.shade600),
                          const SizedBox(height: 12),
                          const Text(
                            'All pending requisitions are cleared!',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadPending,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _pendingOrders.length,
                        itemBuilder: (context, index) {
                          final order = _pendingOrders[index];
                          final totalCost = order.totalEstimatedCost;
                          final isHighValue = totalCost >= 10000;
                          final isBulk = order.totalQuantity >= 1000;

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
                                      Text(
                                        '\$${totalCost.toStringAsFixed(2)}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Color(0xff17634d),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${order.items.length} item(s) • ${order.totalQuantity} total units',
                                    style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                                  ),
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 6,
                                    children: [
                                      if (isHighValue)
                                        Chip(
                                          label: const Text('High Value (\$10k+)'),
                                          backgroundColor: Colors.amber.shade100,
                                          labelStyle: TextStyle(color: Colors.amber.shade900, fontSize: 11),
                                          visualDensity: VisualDensity.compact,
                                        ),
                                      if (isBulk)
                                        Chip(
                                          label: const Text('Bulk Volume (1k+)'),
                                          backgroundColor: Colors.blue.shade100,
                                          labelStyle: TextStyle(color: Colors.blue.shade900, fontSize: 11),
                                          visualDensity: VisualDensity.compact,
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: FilledButton(
                                          style: FilledButton.styleFrom(
                                            backgroundColor: const Color(0xff17634d),
                                          ),
                                          onPressed: () => _approveOrder(order.id),
                                          child: const Text('Approve'),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      OutlinedButton(
                                        onPressed: () => _showReasonModal(order, true),
                                        child: const Text('Revise'),
                                      ),
                                      const SizedBox(width: 8),
                                      OutlinedButton(
                                        style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                                        onPressed: () => _showReasonModal(order, false),
                                        child: const Text('Reject'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
