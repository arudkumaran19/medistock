import 'package:flutter/material.dart';
import '../models/inventory_models.dart';
import '../services/inventory_service.dart';
import 'stock_adjustment_screen.dart';

class BatchDetailScreen extends StatefulWidget {
  const BatchDetailScreen({super.key, required this.batchNumber});
  final String batchNumber;
  @override State<BatchDetailScreen> createState() => _BatchDetailScreenState();
}

class _BatchDetailScreenState extends State<BatchDetailScreen> {
  final service = InventoryService();
  late Future<(MedicineBatch, List<InventoryBalance>, List<InventoryFacility>)> future = _load();
  bool working = false;
  Future<(MedicineBatch, List<InventoryBalance>, List<InventoryFacility>)> _load() async => (await service.lookupBatch(widget.batchNumber), await service.list(), await service.facilities());
  Future<void> _retire(MedicineBatch batch) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(context: context, builder: (context) => AlertDialog(title: const Text('Retire batch'), content: TextField(controller: controller, autofocus: true, decoration: const InputDecoration(labelText: 'Retirement reason')), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Review'))]));
    controller.dispose();
    if (reason == null || reason.trim().isEmpty || !mounted) return;
    final confirm = await showDialog<bool>(context: context, builder: (context) => AlertDialog(title: const Text('Confirm retirement'), content: const Text('Remaining batch stock will be removed with an audit transaction. History is preserved.'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep batch')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Retire batch'))]));
    if (confirm != true || !mounted) return;
    setState(() => working = true);
    try { await service.retireBatch(batch.id, reason); if (mounted) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Batch retired; history preserved.'))); setState(() => future = _load()); } }
    catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not retire batch: $e'))); }
    finally { if (mounted) setState(() => working = false); }
  }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Batch detail')), body: FutureBuilder<(MedicineBatch, List<InventoryBalance>, List<InventoryFacility>)>(future: future, builder: (context, snapshot) {
    if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [Text('Batch could not be loaded: ${snapshot.error}', textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: () => setState(() => future = _load()), child: const Text('Try again'))])));
    final batch = snapshot.data!.$1; final balances = snapshot.data!.$2; final facilities = snapshot.data!.$3;
    final matching = balances.where((x) => x.medicineId == batch.medicineId && x.facilityId == batch.facilityId).firstOrNull;
    final facility = facilities.where((x) => x.id == batch.facilityId).firstOrNull;
    final expired = batch.expiryDateUtc.isBefore(DateTime.now());
    return ListView(padding: const EdgeInsets.all(16), children: [
      Text(batch.medicineName, style: Theme.of(context).textTheme.headlineSmall),
      Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _Line(label: 'Facility', value: facility?.name ?? 'Unknown facility'), _Line(label: 'Batch number', value: batch.batchNumber),
        _Line(label: 'Quantity on hand', value: '${batch.quantityOnHand}'), _Line(label: 'Available quantity', value: '${matching?.availableQuantity ?? '—'}'),
        _Line(label: 'Reserved quantity', value: '${matching?.quantityReserved ?? '—'}'), _Line(label: 'Manufactured', value: batch.manufacturingDateUtc.toLocal().toString().split(' ').first),
        _Line(label: 'Expiry', value: batch.expiryDateUtc.toLocal().toString().split(' ').first),
        _Line(label: 'Status', value: batch.quantityOnHand <= 0 ? 'Retired' : expired ? 'Expired' : 'Active', color: expired ? Colors.deepOrange : Colors.green.shade800),
      ]))),
      if (batch.quantityOnHand > 0) ...[
        FilledButton.icon(onPressed: matching == null || working ? null : () => Navigator.push(context, MaterialPageRoute(builder: (_) => StockAdjustmentScreen(balance: matching))).then((_) => setState(() => future = _load())), icon: const Icon(Icons.tune), label: const Text('Adjust stock')),
        const SizedBox(height: 8), OutlinedButton.icon(onPressed: working ? null : () => _retire(batch), icon: const Icon(Icons.archive_outlined), label: Text(working ? 'Retiring…' : 'Retire batch')),
      ] else const Text('Batch retired. Its stock and audit history are preserved.'),
    ]);
  }));
}

class _Line extends StatelessWidget { const _Line({required this.label, required this.value, this.color}); final String label, value; final Color? color; @override Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(children: [Expanded(child: Text(label, style: const TextStyle(color: Colors.black54))), Expanded(child: Text(value, textAlign: TextAlign.end, style: TextStyle(fontWeight: FontWeight.w600, color: color)))])); }
