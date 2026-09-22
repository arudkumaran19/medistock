import 'package:flutter/material.dart';
import '../services/inventory_service.dart';

class ReceiveStockScreen extends StatefulWidget {
  const ReceiveStockScreen({super.key});
  @override State<ReceiveStockScreen> createState() => _ReceiveStockScreenState();
}

class _ReceiveStockScreenState extends State<ReceiveStockScreen> {
  final batch = TextEditingController(), quantity = TextEditingController(), expiry = TextEditingController(), manufacturing = TextEditingController();
  final service = InventoryService();
  String message = '';
  Future<void> submit() async {
    final batchNumber = batch.text.trim();
    final parsedQuantity = int.tryParse(quantity.text);
    final parsedExpiry = DateTime.tryParse(expiry.text);
    final parsedManufacturing = DateTime.tryParse(manufacturing.text);
    if (batchNumber.isEmpty || batchNumber == '-1') { setState(() => message = 'Enter a meaningful batch number.'); return; }
    if (parsedQuantity == null || parsedQuantity <= 0) { setState(() => message = 'Quantity must be a positive whole number.'); return; }
    if (parsedExpiry == null || parsedManufacturing == null || !parsedExpiry.isAfter(parsedManufacturing)) { setState(() => message = 'Expiry date must be later than manufacture date.'); return; }
    try { await service.receive(medicineId: '22222222-2222-2222-2222-222222222222', facilityId: '11111111-1111-1111-1111-111111111111', batchNumber: batchNumber, quantity: parsedQuantity, expiry: parsedExpiry, manufacturing: parsedManufacturing); setState(() => message = 'Receipt recorded'); } catch (error) { setState(() => message = error.toString()); }
  }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Receive stock')), body: ListView(padding: const EdgeInsets.all(16), children: [TextField(controller: batch, decoration: const InputDecoration(labelText: 'Batch number')), TextField(controller: quantity, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')), TextField(controller: manufacturing, decoration: const InputDecoration(labelText: 'Manufacturing date (YYYY-MM-DD)')), TextField(controller: expiry, decoration: const InputDecoration(labelText: 'Expiry date (YYYY-MM-DD)')), const SizedBox(height: 20), FilledButton(onPressed: submit, child: const Text('Record receipt')), Text(message)]));
}
