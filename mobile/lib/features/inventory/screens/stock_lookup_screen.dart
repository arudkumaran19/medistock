import 'package:flutter/material.dart';
import '../models/inventory_models.dart';
import '../services/inventory_service.dart';
import 'receive_stock_screen.dart';
import 'scan_batch_screen.dart';
import 'stock_adjustment_screen.dart';

class StockLookupScreen extends StatefulWidget {
  const StockLookupScreen({super.key});
  @override State<StockLookupScreen> createState() => _StockLookupScreenState();
}

class _StockLookupScreenState extends State<StockLookupScreen> {
  final service = InventoryService();
  late Future<List<InventoryBalance>> future;
  @override void initState() { super.initState(); future = service.list(); }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Stock lookup'), actions: [IconButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ScanBatchScreen())), icon: const Icon(Icons.qr_code_scanner))]),
    body: FutureBuilder<List<InventoryBalance>>(
      future: future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        return ListView(children: [
          Padding(padding: const EdgeInsets.all(16), child: FilledButton.icon(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReceiveStockScreen())), icon: const Icon(Icons.add), label: const Text('Receive stock'))),
          ...snapshot.data!.map((item) => ListTile(title: Text(item.medicineName), subtitle: Text('${item.facilityName} - available ${item.availableQuantity}'), trailing: Text(item.isBelowMinimum ? 'LOW' : '${item.quantityOnHand}'), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => StockAdjustmentScreen(balance: item))))),
        ]);
      },
    ),
  );
}
