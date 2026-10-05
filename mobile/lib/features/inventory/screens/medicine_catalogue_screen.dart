import 'package:flutter/material.dart';

import '../models/inventory_models.dart';
import '../services/inventory_service.dart';

/// Medicine catalogue with the full CRUD set the web portal exposes:
/// create, read, update, and archive (soft delete).
///
/// Archiving never removes the row. It sets IsActive=false on the server, which
/// hides the medicine from the default list while keeping it and its stock history
/// retrievable through "Show archived". That is the behaviour the backend enforces
/// in MedicineService.ArchiveAsync, and it refuses to archive anything that still
/// holds stock.
class MedicineCatalogueScreen extends StatefulWidget {
  const MedicineCatalogueScreen({super.key});

  @override
  State<MedicineCatalogueScreen> createState() => _MedicineCatalogueScreenState();
}

class _MedicineCatalogueScreenState extends State<MedicineCatalogueScreen> {
  final _service = InventoryService();
  final _search = TextEditingController();

  late Future<List<InventoryMedicine>> _future;
  bool _includeArchived = false;

  @override
  void initState() {
    super.initState();
    _future = _service.medicines(includeArchived: _includeArchived);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _reload() {
    setState(() => _future = _service.medicines(includeArchived: _includeArchived));
  }

  Future<void> _report(Future<void> Function() action, String success) async {
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(success), backgroundColor: const Color(0xFF0F766E)),
      );
      _reload();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendly(e)), backgroundColor: const Color(0xFFDC2626)),
      );
    }
  }

  /// The API returns structured codes; turn the ones users actually hit into
  /// something actionable rather than showing a bare status code.
  String _friendly(Object error) {
    final text = error.toString();
    if (text.contains('MEDICINE_HAS_STOCK')) {
      return 'Cannot archive: stock remains. Clear on-hand and reserved stock first.';
    }
    if (text.contains('REASON_REQUIRED')) return 'A reason is required.';
    if (text.contains('DUPLICATE') || text.contains('409')) {
      return 'That medicine code is already in use.';
    }
    return text.replaceFirst('Exception: ', '');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Medicine catalogue'),
        actions: [
          IconButton(
            tooltip: _includeArchived ? 'Hide archived' : 'Show archived',
            icon: Icon(_includeArchived ? Icons.visibility_off_outlined : Icons.visibility_outlined),
            onPressed: () {
              setState(() => _includeArchived = !_includeArchived);
              _reload();
            },
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _reload,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        icon: const Icon(Icons.add),
        label: const Text('New medicine'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Search by name or code',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                isDense: true,
              ),
            ),
          ),
          if (_includeArchived)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Archived medicines are shown. They are hidden, never deleted.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ),
            ),
          Expanded(child: _buildList()),
        ],
      ),
    );
  }

  Widget _buildList() {
    return FutureBuilder<List<InventoryMedicine>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _Message(
            icon: Icons.error_outline,
            title: 'Could not load medicines',
            detail: _friendly(snapshot.error!),
            action: FilledButton.icon(
              onPressed: _reload,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          );
        }

        final query = _search.text.trim().toLowerCase();
        final items = (snapshot.data ?? [])
            .where((m) =>
                query.isEmpty ||
                m.name.toLowerCase().contains(query) ||
                m.code.toLowerCase().contains(query))
            .toList();

        if (items.isEmpty) {
          return const _Message(
            icon: Icons.inbox_outlined,
            title: 'No medicines found',
            detail: 'Add one with the button below, or clear your search.',
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) => _MedicineCard(
            medicine: items[i],
            onEdit: () => _openEdit(items[i]),
            onArchive: items[i].isActive ? () => _confirmArchive(items[i]) : null,
          ),
        );
      },
    );
  }

  Future<void> _openCreate() async {
    final result = await showModalBottomSheet<_MedicineFormResult>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _MedicineFormSheet(),
    );
    if (result == null) return;

    await _report(
      () => _service.createMedicine(
        code: result.code,
        name: result.name,
        unit: result.unit,
        minimumStockLevel: result.minimumStockLevel,
      ),
      'Medicine "${result.name}" created.',
    );
  }

  Future<void> _openEdit(InventoryMedicine medicine) async {
    final result = await showModalBottomSheet<_MedicineFormResult>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _MedicineFormSheet(existing: medicine),
    );
    if (result == null) return;

    await _report(
      () => _service.updateMedicine(
        medicine.id,
        name: result.name,
        unit: result.unit,
        minimumStockLevel: result.minimumStockLevel,
      ),
      'Medicine "${result.name}" updated.',
    );
  }

  Future<void> _confirmArchive(InventoryMedicine medicine) async {
    final controller = TextEditingController();

    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Archive medicine'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${medicine.name} will be hidden from the catalogue.'),
            const SizedBox(height: 8),
            const Text(
              'The record and its stock history are kept, not deleted. Archiving is '
              'only possible once all on-hand and reserved stock is cleared.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Reason',
                hintText: 'e.g. discontinued',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () {
              final text = controller.text.trim();
              // The server requires a reason; refusing here keeps the button
              // honest instead of sending a request that will be rejected.
              if (text.isEmpty) return;
              Navigator.pop(dialogContext, text);
            },
            child: const Text('Archive'),
          ),
        ],
      ),
    );

    if (reason == null || reason.isEmpty) return;

    await _report(
      () => _service.archiveMedicine(medicine.id, reason),
      '${medicine.name} archived. The record is retained.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────

class _MedicineCard extends StatelessWidget {
  const _MedicineCard({required this.medicine, required this.onEdit, this.onArchive});

  final InventoryMedicine medicine;
  final VoidCallback onEdit;
  final VoidCallback? onArchive;

  @override
  Widget build(BuildContext context) {
    final archived = !medicine.isActive;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: archived ? const Color(0xFFF8FAFC) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: archived ? const Color(0xFFE2E8F0) : const Color(0xFFD7E4E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  medicine.name,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: archived ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                  ),
                ),
              ),
              if (archived)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'Archived',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${medicine.code} · ${medicine.unit} · min ${medicine.minimumStockLevel}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: archived ? null : onEdit,
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: const Text('Edit'),
              ),
              const SizedBox(width: 10),
              if (onArchive != null)
                TextButton.icon(
                  onPressed: onArchive,
                  style: TextButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
                  icon: const Icon(Icons.archive_outlined, size: 18),
                  label: const Text('Archive'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────

class _MedicineFormResult {
  const _MedicineFormResult({
    required this.code,
    required this.name,
    required this.unit,
    required this.minimumStockLevel,
  });

  final String code, name, unit;
  final int minimumStockLevel;
}

class _MedicineFormSheet extends StatefulWidget {
  const _MedicineFormSheet({this.existing});
  final InventoryMedicine? existing;

  @override
  State<_MedicineFormSheet> createState() => _MedicineFormSheetState();
}

class _MedicineFormSheetState extends State<_MedicineFormSheet> {
  late final TextEditingController _code;
  late final TextEditingController _name;
  late final TextEditingController _unit;
  late final TextEditingController _minimum;
  String? _error;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _code = TextEditingController(text: existing?.code ?? '');
    _name = TextEditingController(text: existing?.name ?? '');
    _unit = TextEditingController(text: existing?.unit ?? '');
    _minimum = TextEditingController(text: '${existing?.minimumStockLevel ?? 0}');
  }

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _unit.dispose();
    _minimum.dispose();
    super.dispose();
  }

  void _submit() {
    final code = _code.text.trim();
    final name = _name.text.trim();
    final unit = _unit.text.trim();
    final minimum = int.tryParse(_minimum.text.trim());

    if (!_isEdit && code.isEmpty) {
      setState(() => _error = 'A medicine code is required.');
      return;
    }
    if (name.isEmpty) {
      setState(() => _error = 'A medicine name is required.');
      return;
    }
    if (unit.isEmpty) {
      setState(() => _error = 'A unit is required, for example tablet or capsule.');
      return;
    }
    if (minimum == null || minimum < 0) {
      setState(() => _error = 'Minimum stock must be zero or more.');
      return;
    }

    Navigator.pop(
      context,
      _MedicineFormResult(code: code, name: name, unit: unit, minimumStockLevel: minimum),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _isEdit ? 'Edit medicine' : 'New medicine',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _code,
              // The code identifies the medicine on the server and is not editable.
              enabled: !_isEdit,
              decoration: const InputDecoration(
                labelText: 'Medicine code',
                hintText: 'e.g. PARA-500',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _name,
              decoration: const InputDecoration(
                labelText: 'Medicine name',
                hintText: 'e.g. Paracetamol 500 mg',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _unit,
                    decoration: const InputDecoration(
                      labelText: 'Unit',
                      hintText: 'tablet',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _minimum,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Minimum stock',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submit,
                child: Text(_isEdit ? 'Save changes' : 'Create medicine'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.title, required this.detail, this.action});

  final IconData icon;
  final String title, detail;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
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
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}
