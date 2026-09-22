import 'package:flutter/material.dart';
import '../models/inventory_models.dart';
import '../services/inventory_service.dart';

class StockAdjustmentScreen extends StatefulWidget { const StockAdjustmentScreen({super.key, required this.balance}); final InventoryBalance balance; @override State<StockAdjustmentScreen> createState() => _StockAdjustmentScreenState(); }
class _StockAdjustmentScreenState extends State<StockAdjustmentScreen> {
  final delta = TextEditingController(), reason = TextEditingController(); String message = '';
  Future<void> submit() async { try { await InventoryService().adjust(medicineId: widget.balance.medicineId, facilityId: widget.balance.facilityId, delta: int.parse(delta.text), reason: reason.text); setState(() => message = 'Stock updated and minimum level validated by the backend.'); } catch (error) { setState(() => message = error.toString()); } }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Adjust stock')), body: ListView(padding: const EdgeInsets.all(16), children: [Text(widget.balance.medicineName), TextField(controller: delta, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity delta')), TextField(controller: reason, decoration: const InputDecoration(labelText: 'Reason')), FilledButton(onPressed: submit, child: const Text('Update stock')), Text(message)]));
}
