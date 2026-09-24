import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'batch_detail_screen.dart';

class ScanBatchScreen extends StatefulWidget {
  const ScanBatchScreen({super.key});
  @override State<ScanBatchScreen> createState() => _ScanBatchScreenState();
}

class _ScanBatchScreenState extends State<ScanBatchScreen> {
  final controller = TextEditingController();
  bool handled = false;
  String feedback = '';
  Future<void> openBatch(String raw) async {
    final value = raw.trim();
    if (handled) return;
    if (value.isEmpty) { setState(() => feedback = 'No batch number was found. Scan again or enter it below.'); return; }
    setState(() { handled = true; feedback = 'Batch $value found. Loading details…'; });
    await Navigator.push(context, MaterialPageRoute(builder: (_) => BatchDetailScreen(batchNumber: value)));
    if (mounted) setState(() { handled = false; feedback = 'Ready to scan another batch.'; });
  }
  @override void dispose() { controller.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Scan batch')),
    body: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        SizedBox(height: 240, child: MobileScanner(onDetect: (capture) { final value = capture.barcodes.firstOrNull?.rawValue; if (value != null) openBatch(value); })),
        const SizedBox(height: 16),
        const Text('DataMatrix scan or manual development fallback'),
        TextField(controller: controller, decoration: const InputDecoration(labelText: 'Manual batch number fallback')),
        FilledButton(onPressed: handled ? null : () => openBatch(controller.text), child: const Text('Retrieve stock')),
        if (feedback.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(feedback, textAlign: TextAlign.center)),
      ]),
    ),
  );
}
