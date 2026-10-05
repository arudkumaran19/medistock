import 'package:flutter/material.dart';
import '../models/inventory_models.dart';
import '../services/inventory_service.dart';
import 'receive_stock_screen.dart';
import 'scan_batch_screen.dart';
import 'stock_adjustment_screen.dart';

class StockLookupScreen extends StatefulWidget {
  const StockLookupScreen({super.key});

  @override
  State<StockLookupScreen> createState() => _StockLookupScreenState();
}

class _StockLookupScreenState extends State<StockLookupScreen> {
  final service = InventoryService();
  late Future<List<InventoryBalance>> future = service.list();
  String query = '';

  Future<void> refresh() async {
    setState(() => future = service.list());
    await future;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Stock lookup'),
          actions: [
            IconButton(
              tooltip: 'Scan batch',
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const ScanBatchScreen(),
                ),
              ).then((_) => refresh()),
              icon: const Icon(Icons.qr_code_scanner),
            ),
          ],
        ),
        body: FutureBuilder<List<InventoryBalance>>(
          future: future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(),
              );
            }

            if (snapshot.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off, size: 40),
                      const SizedBox(height: 12),
                      Text(
                        'Stock could not be loaded: ${snapshot.error}',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: () =>
                            setState(() => future = service.list()),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Try again'),
                      ),
                    ],
                  ),
                ),
              );
            }

            final rows = snapshot.data ?? [];

            final filtered = rows
                .where(
                  (x) => '${x.medicineName} ${x.facilityName}'
                      .toLowerCase()
                      .contains(query.trim().toLowerCase()),
                )
                .toList();

            return RefreshIndicator(
              onRefresh: refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  TextField(
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      labelText: 'Search medicine or facility',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (value) =>
                        setState(() => query = value),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ReceiveStockScreen(),
                      ),
                    ).then((_) => refresh()),
                    icon: const Icon(Icons.add),
                    label: const Text('Receive stock'),
                  ),
                  const SizedBox(height: 16),
                  if (filtered.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'No balances match this search.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ...filtered.map(
                    (item) => Card(
                      child: ListTile(
                        isThreeLine: true,
                        title: Text(item.medicineName),
                        subtitle: Text(
                          '${item.facilityName}\n'
                          'On hand ${item.quantityOnHand} · '
                          'Available ${item.availableQuantity} · '
                          'Reserved ${item.quantityReserved}',
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              item.isBelowMinimum
                                  ? Icons.warning_amber_rounded
                                  : Icons.check_circle_outline,
                              color: item.isBelowMinimum
                                  ? Colors.deepOrange
                                  : Colors.green,
                            ),
                            Text(
                              item.isBelowMinimum ? 'LOW' : 'NORMAL',
                              style: TextStyle(
                                fontSize: 11,
                                color: item.isBelowMinimum
                                    ? Colors.deepOrange
                                    : Colors.green,
                              ),
                            ),
                          ],
                        ),
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                StockAdjustmentScreen(balance: item),
                          ),
                        ).then((_) => refresh()),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );
}