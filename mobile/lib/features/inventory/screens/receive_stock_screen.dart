import 'package:flutter/material.dart';
import '../models/inventory_models.dart';
import '../services/inventory_service.dart';

class ReceiveStockScreen extends StatefulWidget {
  const ReceiveStockScreen({super.key});
  @override State<ReceiveStockScreen> createState() => _ReceiveStockScreenState();
}

class _ReceiveStockScreenState extends State<ReceiveStockScreen> {
  final batch = TextEditingController(), quantity = TextEditingController(), expiry = TextEditingController(), manufacturing = TextEditingController();
  final service = InventoryService();
  List<InventoryMedicine> medicines = [];
  List<InventoryFacility> facilities = [];
  String? medicineId, facilityId;
  String message = '', error = '';
  bool loading = true, submitting = false;
  @override void initState() { super.initState(); loadCatalog(); }
  Future<void> loadCatalog() async {
    try { final values = await Future.wait([service.medicines(), service.facilities()]); if (!mounted) return; setState(() { medicines = values[0] as List<InventoryMedicine>; facilities = values[1] as List<InventoryFacility>; medicineId = medicines.firstOrNull?.id; facilityId = facilities.firstOrNull?.id; loading = false; }); }
    catch (e) { if (mounted) setState(() { error = 'Could not load medicines and facilities: $e'; loading = false; }); }
  }
  Future<void> submit() async {
    final batchNumber = batch.text.trim(); final parsedQuantity = int.tryParse(quantity.text);
    final parsedExpiry = DateTime.tryParse(expiry.text); final parsedManufacturing = DateTime.tryParse(manufacturing.text);
    if (medicineId == null || facilityId == null) { setState(() => error = 'Select an active medicine and facility.'); return; }
    if (batchNumber.isEmpty || batchNumber == '-1') { setState(() => error = 'Enter a meaningful batch number.'); return; }
    if (parsedQuantity == null || parsedQuantity <= 0) { setState(() => error = 'Quantity must be a positive whole number.'); return; }
    if (parsedExpiry == null || parsedManufacturing == null || !parsedExpiry.isAfter(parsedManufacturing)) { setState(() => error = 'Expiry date must be later than manufacture date.'); return; }
    setState(() { error = ''; message = ''; submitting = true; });
    try { await service.receive(medicineId: medicineId!, facilityId: facilityId!, batchNumber: batchNumber, quantity: parsedQuantity, expiry: parsedExpiry, manufacturing: parsedManufacturing); if (mounted) setState(() => message = 'Receipt recorded for $batchNumber.'); }
    catch (e) { if (mounted) setState(() => error = e.toString()); }
    finally { if (mounted) setState(() => submitting = false); }
  }
  @override void dispose() { batch.dispose(); quantity.dispose(); expiry.dispose(); manufacturing.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Receive stock')), body: loading ? const Center(child: CircularProgressIndicator()) : ListView(padding: const EdgeInsets.all(16), children: [
    if (error.isNotEmpty) _Notice(message: error, isError: true), if (message.isNotEmpty) _Notice(message: message),
    DropdownButtonFormField<String>(value: medicineId, decoration: const InputDecoration(labelText: 'Medicine'), items: medicines.map((x) => DropdownMenuItem(value: x.id, child: Text('${x.name} (${x.code})'))).toList(), onChanged: (value) => setState(() => medicineId = value)),
    DropdownButtonFormField<String>(value: facilityId, decoration: const InputDecoration(labelText: 'Facility'), items: facilities.map((x) => DropdownMenuItem(value: x.id, child: Text(x.name))).toList(), onChanged: (value) => setState(() => facilityId = value)),
    TextField(controller: batch, decoration: const InputDecoration(labelText: 'Batch number', hintText: 'e.g. ABC-123')),
    TextField(controller: quantity, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
    TextField(controller: manufacturing, keyboardType: TextInputType.datetime, decoration: const InputDecoration(labelText: 'Manufacture date (YYYY-MM-DD)')),
    TextField(controller: expiry, keyboardType: TextInputType.datetime, decoration: const InputDecoration(labelText: 'Expiry date (YYYY-MM-DD)')),
    const SizedBox(height: 20), FilledButton.icon(onPressed: submitting || medicines.isEmpty || facilities.isEmpty ? null : submit, icon: submitting ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.inventory_2_outlined), label: Text(submitting ? 'Recording receipt…' : 'Record receipt')),
  ]));
}

class _Notice extends StatelessWidget { const _Notice({required this.message, this.isError = false}); final String message; final bool isError; @override Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(message, style: TextStyle(color: isError ? Theme.of(context).colorScheme.error : Colors.green.shade800))); }
