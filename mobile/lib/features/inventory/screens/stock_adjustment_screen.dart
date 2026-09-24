import 'package:flutter/material.dart';
import '../models/inventory_models.dart';
import '../services/inventory_service.dart';

class StockAdjustmentScreen extends StatefulWidget { const StockAdjustmentScreen({super.key, required this.balance}); final InventoryBalance balance; @override State<StockAdjustmentScreen> createState() => _StockAdjustmentScreenState(); }
class _StockAdjustmentScreenState extends State<StockAdjustmentScreen> {
  final delta = TextEditingController(), reason = TextEditingController();
  String message = '', error = ''; bool submitting = false;
  Future<void> submit() async {
    final quantity = int.tryParse(delta.text);
    if (quantity == null || quantity == 0) { setState(() => error = 'Enter a non-zero whole-number quantity delta.'); return; }
    if (reason.text.trim().isEmpty) { setState(() => error = 'A reason is required for the audit record.'); return; }
    setState(() { error = ''; message = ''; submitting = true; });
    try { await InventoryService().adjust(medicineId: widget.balance.medicineId, facilityId: widget.balance.facilityId, delta: quantity, reason: reason.text.trim()); if (mounted) setState(() => message = 'Stock updated. Backend rules validated the available quantity.'); }
    catch (e) { if (mounted) setState(() => error = e.toString()); }
    finally { if (mounted) setState(() => submitting = false); }
  }
  @override void dispose() { delta.dispose(); reason.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Adjust stock')), body: ListView(padding: const EdgeInsets.all(16), children: [
    Text(widget.balance.medicineName, style: Theme.of(context).textTheme.headlineSmall), Text(widget.balance.facilityName),
    Card(child: Padding(padding: const EdgeInsets.all(16), child: Text('On hand ${widget.balance.quantityOnHand} · Available ${widget.balance.availableQuantity} · Reserved ${widget.balance.quantityReserved} · Minimum ${widget.balance.minimumStockLevel}'))),
    if (error.isNotEmpty) Text(error, style: TextStyle(color: Theme.of(context).colorScheme.error)), if (message.isNotEmpty) Text(message, style: TextStyle(color: Colors.green.shade800)),
    TextField(controller: delta, keyboardType: const TextInputType.numberWithOptions(signed: true), decoration: const InputDecoration(labelText: 'Quantity delta', helperText: 'Use a positive or negative whole number')),
    TextField(controller: reason, decoration: const InputDecoration(labelText: 'Reason')),
    const SizedBox(height: 16), FilledButton(onPressed: submitting ? null : submit, child: Text(submitting ? 'Saving…' : 'Record adjustment')),
  ]));
}
