import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../models/transfer_models.dart';
import '../services/transfer_api_service.dart';

class ReceiveTransferScreen extends StatefulWidget {
  final Transfer transfer;
  final TransferApiService? apiService;

  const ReceiveTransferScreen({
    super.key,
    required this.transfer,
    this.apiService,
  });

  @override
  State<ReceiveTransferScreen> createState() => _ReceiveTransferScreenState();
}

class _ReceiveTransferScreenState extends State<ReceiveTransferScreen> {
  late final TransferApiService _apiService;
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _quantityController;
  late final TextEditingController _batchController;
  final _discrepancyController = TextEditingController();
  final _notesController = TextEditingController();

  bool _isLoading = false;
  String? _errorMessage;
  String? _selectedDiscrepancyType;

  final List<String> _discrepancyOptions = [
    'Damaged / Broken Vials during road transit',
    'Shortfall in packaging / Missing units',
    'Temperature cold-chain breach detected',
    'Mismatched batch or label discrepancy',
    'Other (specified in notes)',
  ];

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? TransferApiService();
    final initialQty = widget.transfer.totalAllocatedQuantity > 0
        ? widget.transfer.totalAllocatedQuantity
        : widget.transfer.totalRequestedQuantity;

    _quantityController = TextEditingController(text: initialQty.toString());
    _batchController = TextEditingController(
      text: widget.transfer.primaryBatchNumber ?? 'BAT-${DateTime.now().year}-ALLOC',
    );
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _batchController.dispose();
    _discrepancyController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  bool get _hasDiscrepancy {
    final expected = widget.transfer.totalAllocatedQuantity > 0
        ? widget.transfer.totalAllocatedQuantity
        : widget.transfer.totalRequestedQuantity;
    final entered = int.tryParse(_quantityController.text.trim()) ?? expected;
    return entered != expected || _selectedDiscrepancyType != null;
  }

  Future<void> _handleConfirmReceipt() async {
    if (!_formKey.currentState!.validate()) return;

    final receivedQty = int.parse(_quantityController.text.trim());
    final expectedQty = widget.transfer.totalAllocatedQuantity > 0
        ? widget.transfer.totalAllocatedQuantity
        : widget.transfer.totalRequestedQuantity;

    if (receivedQty != expectedQty && _selectedDiscrepancyType == null) {
      setState(() {
        _errorMessage = 'Discrepancy detected: Please select a reason for the quantity difference.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final reason = _selectedDiscrepancyType != null
          ? (_discrepancyController.text.trim().isNotEmpty
              ? '$_selectedDiscrepancyType: ${_discrepancyController.text.trim()}'
              : _selectedDiscrepancyType)
          : null;

      await _apiService.receiveTransfer(
        transferId: widget.transfer.id,
        receivedQuantity: receivedQty,
        batchNumber: _batchController.text.trim(),
        destinationFacilityId: widget.transfer.destinationFacilityId,
        discrepancyReason: reason,
        notes: _notesController.text.trim().isNotEmpty
            ? _notesController.text.trim()
            : 'Delivery verified and received by hospital pharmacy staff.',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.primary,
            content: Text('Delivery receipt successfully verified and authoritative stock logged.'),
          ),
        );
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final expectedQuantity = widget.transfer.totalAllocatedQuantity > 0
        ? widget.transfer.totalAllocatedQuantity
        : widget.transfer.totalRequestedQuantity;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Confirm Delivery & Verification',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Summary Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          widget.transfer.transferNumber,
                          style: const TextStyle(
                            color: AppColors.secondary,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            fontFamily: 'monospace',
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.statusInTransit.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Awaiting Receipt',
                            style: TextStyle(
                              color: AppColors.statusInTransit,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      widget.transfer.primaryMedicineName,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Dispatch Consignment: $expectedQuantity units from ${widget.transfer.sourceFacilityName ?? "Central"}',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.statusRejected.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.statusRejected.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.statusRejected, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: AppColors.statusRejected, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),

              // Physical Received Quantity Input
              const Text(
                'Physical Count Received',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _quantityController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  hintText: 'e.g. $expectedQuantity',
                  hintStyle: const TextStyle(color: AppColors.textMuted),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                  prefixIcon: const Icon(Icons.check_circle_outline_rounded, color: AppColors.primary),
                  suffixText: 'units',
                  suffixStyle: const TextStyle(color: AppColors.textSecondary),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Enter received quantity';
                  final n = int.tryParse(val.trim());
                  if (n == null || n < 0) return 'Must be a non-negative integer';
                  return null;
                },
              ),

              const SizedBox(height: 18),

              // Batch / Lot Barcode Verification
              const Text(
                'Physical Batch / Lot Number',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _batchController,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  hintText: 'e.g. BAT-2026-X1',
                  hintStyle: const TextStyle(color: AppColors.textMuted),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                  prefixIcon: const Icon(Icons.qr_code_scanner_rounded, color: AppColors.secondary),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Enter or scan verified batch number';
                  return null;
                },
              ),

              const SizedBox(height: 18),

              // Discrepancy Section (Auto-highlighted if count differs)
              if (_hasDiscrepancy) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.statusRequested.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.statusRequested.withOpacity(0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.warning_amber_rounded, color: AppColors.statusRequested, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Discrepancy Declaration Required',
                            style: TextStyle(
                              color: AppColors.statusRequested,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Select primary discrepancy factor:',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedDiscrepancyType,
                            isExpanded: true,
                            hint: const Text(
                              'Select discrepancy cause...',
                              style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                            ),
                            dropdownColor: AppColors.surface,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            items: _discrepancyOptions.map((opt) {
                              return DropdownMenuItem<String>(
                                value: opt,
                                child: Text(opt),
                              );
                            }).toList(),
                            onChanged: (val) => setState(() => _selectedDiscrepancyType = val),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextFormField(
                        controller: _discrepancyController,
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: AppColors.surface,
                          hintText: 'Additional discrepancy details (e.g. 5 vials shattered)...',
                          hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
              ],

              // Verification Sign-off Notes
              const Text(
                'Pharmacist Verification Notes',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _notesController,
                maxLines: 2,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  hintText: 'e.g. Storage temperature checked OK, accepted into inventory.',
                  hintStyle: const TextStyle(color: AppColors.textMuted),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // Confirm Receipt Button
              ElevatedButton(
                onPressed: _isLoading ? null : _handleConfirmReceipt,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inventory_rounded, size: 20, color: Colors.white),
                          SizedBox(width: 8),
                          Text(
                            'Confirm & Finalize Delivery Receipt',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
