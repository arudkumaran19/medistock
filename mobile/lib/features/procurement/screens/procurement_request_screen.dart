import 'package:flutter/material.dart';
import '../models/procurement_models.dart';
import '../services/procurement_service.dart';
import '../../inventory/models/inventory_models.dart';
import '../../inventory/services/inventory_service.dart';

class ProcurementRequestScreen extends StatefulWidget {
  const ProcurementRequestScreen({super.key});

  @override
  State<ProcurementRequestScreen> createState() => _ProcurementRequestScreenState();
}

class _ProcurementRequestScreenState extends State<ProcurementRequestScreen> {
  final _procurementService = MobileProcurementService();
  final _inventoryService = InventoryService();
  final _quantityController = TextEditingController(text: '100');
  final _priceController = TextEditingController(text: '12.50');

  List<InventoryMedicine> _medicines = [];
  List<InventoryFacility> _facilities = [];
  List<MobileSupplier> _suppliers = [];

  String? _selectedMedicineId;
  String? _selectedFacilityId;
  String? _selectedSupplierId;

  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  String? _successMessage;
  MobilePolicyValidationResult? _validationResult;

  @override
  void initState() {
    super.initState();
    _loadCatalogs();
  }

  Future<void> _loadCatalogs() async {
    try {
      final results = await Future.wait([
        _inventoryService.medicines(),
        _inventoryService.facilities(),
        _procurementService.getSuppliers(isActive: true),
      ]);
      if (!mounted) return;
      setState(() {
        _medicines = results[0] as List<InventoryMedicine>;
        _facilities = results[1] as List<InventoryFacility>;
        _suppliers = results[2] as List<MobileSupplier>;
        _selectedMedicineId = _medicines.firstOrNull?.id;
        _selectedFacilityId = _facilities.firstOrNull?.id;
        _selectedSupplierId = _suppliers.firstOrNull?.id;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Could not load required catalogs: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _validatePolicy() async {
    if (_selectedFacilityId == null || _selectedSupplierId == null) return;
    final qty = int.tryParse(_quantityController.text) ?? 100;
    final price = double.tryParse(_priceController.text) ?? 12.5;
    try {
      final res = await _procurementService.validateProcurement(
        facilityId: _selectedFacilityId!,
        supplierId: _selectedSupplierId!,
        totalCost: qty * price,
        totalQuantity: qty,
      );
      if (mounted) {
        setState(() {
          _validationResult = res;
        });
      }
    } catch (e) {
      // Ignored for pre-check
    }
  }

  Future<void> _submitRequest() async {
    final qty = int.tryParse(_quantityController.text);
    final price = double.tryParse(_priceController.text);

    if (_selectedMedicineId == null || _selectedFacilityId == null || _selectedSupplierId == null) {
      setState(() => _errorMessage = 'Please select a medicine, facility, and supplier.');
      return;
    }
    if (qty == null || qty <= 0) {
      setState(() => _errorMessage = 'Requested quantity must be greater than zero.');
      return;
    }
    if (price == null || price < 0) {
      setState(() => _errorMessage = 'Unit price cannot be negative.');
      return;
    }

    setState(() {
      _errorMessage = null;
      _successMessage = null;
      _isSubmitting = true;
    });

    try {
      final po = await _procurementService.createPurchaseOrder(
        supplierId: _selectedSupplierId!,
        facilityId: _selectedFacilityId!,
        items: [
          MobilePurchaseOrderItem(
            medicineId: _selectedMedicineId!,
            requestedQuantity: qty,
            unitPrice: price,
          )
        ],
      );

      // Submit for approval
      await _procurementService.submitPurchaseOrder(po.id);

      if (mounted) {
        setState(() {
          _successMessage = 'Purchase requisition submitted successfully (Ref: ${po.id.substring(0, 8)}…).';
          _isSubmitting = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Procurement Requisition'),
        backgroundColor: const Color(0xff17634d),
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      border: Border.all(color: Colors.red.shade200),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade800)),
                  ),
                if (_successMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      border: Border.all(color: Colors.green.shade200),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_successMessage!, style: TextStyle(color: Colors.green.shade800)),
                  ),
                Card(
                  elevation: 0,
                  color: Colors.white,
                  shape: RoundedRectangleBorder(
                    side: BorderSide(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Select Requisition Parameters',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String>(
                          value: _selectedMedicineId,
                          decoration: const InputDecoration(
                            labelText: 'Medicine Item *',
                            border: OutlineInputBorder(),
                          ),
                          items: _medicines.map((m) {
                            return DropdownMenuItem(
                              value: m.id,
                              child: Text('${m.name} (${m.code})'),
                            );
                          }).toList(),
                          onChanged: (v) => setState(() => _selectedMedicineId = v),
                        ),
                        const SizedBox(height: 14),
                        DropdownButtonFormField<String>(
                          value: _selectedSupplierId,
                          decoration: const InputDecoration(
                            labelText: 'Authorized Supplier *',
                            border: OutlineInputBorder(),
                          ),
                          items: _suppliers.map((s) {
                            return DropdownMenuItem(
                              value: s.id,
                              child: Text('${s.name} (${s.code})'),
                            );
                          }).toList(),
                          onChanged: (v) {
                            setState(() => _selectedSupplierId = v);
                            _validatePolicy();
                          },
                        ),
                        const SizedBox(height: 14),
                        DropdownButtonFormField<String>(
                          value: _selectedFacilityId,
                          decoration: const InputDecoration(
                            labelText: 'Target Healthcare Facility *',
                            border: OutlineInputBorder(),
                          ),
                          items: _facilities.map((f) {
                            return DropdownMenuItem(
                              value: f.id,
                              child: Text(f.name),
                            );
                          }).toList(),
                          onChanged: (v) => setState(() => _selectedFacilityId = v),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _quantityController,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Quantity (units) *',
                                  border: OutlineInputBorder(),
                                ),
                                onChanged: (_) => _validatePolicy(),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextField(
                                controller: _priceController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: const InputDecoration(
                                  labelText: 'Unit Price (\$) *',
                                  border: OutlineInputBorder(),
                                ),
                                onChanged: (_) => _validatePolicy(),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                if (_validationResult != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _validationResult!.isValid ? Colors.teal.shade50 : Colors.amber.shade50,
                      border: Border.all(
                        color: _validationResult!.isValid ? Colors.teal.shade300 : Colors.amber.shade400,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Policy Check: ${_validationResult!.isValid ? "COMPLIANT" : "FLAGGED"}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: _validationResult!.isValid ? Colors.teal.shade900 : Colors.amber.shade900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _validationResult!.message,
                          style: const TextStyle(fontSize: 13),
                        ),
                        if (_validationResult!.requiresApproval)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              '⚠️ Requires ${_validationResult!.approverRole ?? "managerial"} sign-off.',
                              style: TextStyle(fontSize: 12, color: Colors.amber.shade900, fontWeight: FontWeight.bold),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _isSubmitting ? null : _submitRequest,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xff17634d),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                  label: Text(_isSubmitting ? 'Submitting Requisition…' : 'Submit for Approval'),
                ),
              ],
            ),
    );
  }
}
