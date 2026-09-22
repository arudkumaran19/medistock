import 'package:flutter/material.dart';
import '../services/inventory_service.dart';

class BatchDetailScreen extends StatelessWidget {
  const BatchDetailScreen({super.key, required this.batchNumber});
  final String batchNumber;
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Batch detail')), body: FutureBuilder(future: InventoryService().lookupBatch(batchNumber), builder: (context, snapshot) { if (!snapshot.hasData) return const Center(child: CircularProgressIndicator()); final match = snapshot.data!; return Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(match.medicineName, style: Theme.of(context).textTheme.headlineSmall), Text('Batch: ${match.batchNumber}'), Text('Quantity: ${match.quantityOnHand}'), Text('Expires: ${match.expiryDateUtc.toIso8601String()}')])); }));
}
