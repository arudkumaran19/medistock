import 'package:flutter/material.dart';

import '../models/inventory_models.dart';
import '../services/inventory_service.dart';
import 'batch_detail_screen.dart';

/// Batches approaching expiry, grouped by urgency.
///
/// Mirrors the web Expiry Monitor. The horizon is adjustable because a store
/// keeper checking today's risk and a manager planning a quarter need different
/// windows.
class ExpiryMonitorScreen extends StatefulWidget {
  const ExpiryMonitorScreen({super.key});

  @override
  State<ExpiryMonitorScreen> createState() => _ExpiryMonitorScreenState();
}

class _ExpiryMonitorScreenState extends State<ExpiryMonitorScreen> {
  static const _horizons = <int>[30, 60, 90, 180];

  final _service = InventoryService();
  int _days = 90;
  late Future<List<MedicineBatch>> _future;

  @override
  void initState() {
    super.initState();
    _future = _service.expiring(days: _days);
  }

  void _reload() => setState(() => _future = _service.expiring(days: _days));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Expiry monitor'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), tooltip: 'Refresh', onPressed: _reload),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                const Text('Within', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(width: 12),
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    children: _horizons
                        .map((d) => ChoiceChip(
                              label: Text('$d days'),
                              selected: _days == d,
                              onSelected: (_) {
                                setState(() => _days = d);
                                _reload();
                              },
                            ))
                        .toList(),
                  ),
                ),
              ],
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    return FutureBuilder<List<MedicineBatch>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _centered(
            Icons.error_outline,
            'Could not load expiring batches',
            snapshot.error.toString().replaceFirst('Exception: ', ''),
            FilledButton.icon(
              onPressed: _reload,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          );
        }

        final batches = [...(snapshot.data ?? [])]
          ..sort((a, b) => a.expiryDateUtc.compareTo(b.expiryDateUtc));

        if (batches.isEmpty) {
          return _centered(
            Icons.verified_outlined,
            'Nothing expiring',
            'No batch expires within $_days days.',
            null,
          );
        }

        final today = DateTime.now().toUtc();

        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          itemCount: batches.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) {
            final batch = batches[i];
            final daysLeft = batch.expiryDateUtc.difference(today).inDays;

            return _ExpiryCard(
              batch: batch,
              daysLeft: daysLeft,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => BatchDetailScreen(batchNumber: batch.batchNumber),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _centered(IconData icon, String title, String detail, Widget? action) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: const Color(0xFF94A3B8)),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              detail,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            if (action != null) ...[const SizedBox(height: 16), action],
          ],
        ),
      ),
    );
  }
}

class _ExpiryCard extends StatelessWidget {
  const _ExpiryCard({required this.batch, required this.daysLeft, required this.onTap});

  final MedicineBatch batch;
  final int daysLeft;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Expired first, then the window where there is no time to reorder.
    final (Color accent, String label) = daysLeft < 0
        ? (const Color(0xFFDC2626), 'Expired')
        : daysLeft <= 30
            ? (const Color(0xFFDC2626), '$daysLeft days left')
            : daysLeft <= 60
                ? (const Color(0xFFD97706), '$daysLeft days left')
                : (const Color(0xFF0F766E), '$daysLeft days left');

    final expiry = batch.expiryDateUtc.toLocal();

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFD7E4E1)),
        ),
        child: Row(
          children: [
            Container(width: 4, height: 46, color: accent),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    batch.medicineName,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${batch.batchNumber} · ${batch.quantityOnHand} on hand',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Expires ${expiry.year}-${expiry.month.toString().padLeft(2, '0')}-${expiry.day.toString().padLeft(2, '0')}',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                label,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: accent),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
