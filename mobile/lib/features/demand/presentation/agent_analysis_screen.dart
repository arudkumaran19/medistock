import 'package:flutter/material.dart';

import '../../../core/network/api_client.dart';
import '../../inventory/models/inventory_models.dart';
import '../../inventory/services/inventory_service.dart';

/// One run of the Demand & Shortage specialist agent.
///
/// Sathurstiga S. (IT24103156).
///
/// The agent is advisory. Every figure it reports comes from a deterministic
/// backend tool, its result always carries requiredValidation = true, and it can
/// approve or change nothing. What the model contributes is which tools to call and
/// how to explain the result - shown here as the AI assessment, kept visually
/// distinct from the measured findings so the two are never confused.
///
/// Flutter never calls the agent service directly. The request goes to ASP.NET Core,
/// which holds the internal service token (blueprint sections 23 and 37).
class AgentAnalysisScreen extends StatefulWidget {
  const AgentAnalysisScreen({super.key});

  @override
  State<AgentAnalysisScreen> createState() => _AgentAnalysisScreenState();
}

class _AgentAnalysisScreenState extends State<AgentAnalysisScreen> {
  final _client = ApiClient();
  final _inventory = InventoryService();
  final _objective = TextEditingController(text: 'Will this facility run out of this medicine?');
  final _stock = TextEditingController();

  List<InventoryBalance> _balances = const [];
  InventoryBalance? _selected;

  bool _loadingContext = true;
  bool _running = false;
  String? _error;
  Map<String, dynamic>? _run;

  @override
  void initState() {
    super.initState();
    _loadContext();
  }

  @override
  void dispose() {
    _objective.dispose();
    _stock.dispose();
    super.dispose();
  }

  Future<void> _loadContext() async {
    try {
      final balances = await _inventory.list();
      if (!mounted) return;
      setState(() {
        _balances = balances;
        _selected = balances.isNotEmpty ? balances.first : null;
        _stock.text = '${_selected?.quantityOnHand ?? 0}';
        _loadingContext = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _friendly(e);
        _loadingContext = false;
      });
    }
  }

  String _friendly(Object error) {
    final text = error.toString();
    if (text.contains('AGENT_UNAVAILABLE') || text.contains('503')) {
      return 'The agent service is not reachable. Nothing was analysed and nothing changed.';
    }
    if (text.contains('403')) {
      return 'Your role cannot run the agent. Sign in as a facility manager.';
    }
    return text.replaceFirst('Exception: ', '');
  }

  Future<void> _run_() async {
    final selected = _selected;
    if (selected == null) return;

    setState(() {
      _running = true;
      _error = null;
      _run = null;
    });

    try {
      final response = await _client.request(
        '/api/demand/agent/analyze',
        method: 'POST',
        body: {
          'facilityId': selected.facilityId,
          'medicineId': selected.medicineId,
          'objective': _objective.text.trim(),
          'currentStock': int.tryParse(_stock.text.trim()) ?? selected.quantityOnHand,
          'windowDays': 30,
        },
      );
      if (!mounted) return;
      setState(() => _run = Map<String, dynamic>.from(response as Map));
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = _friendly(e));
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Demand agent')),
      body: _loadingContext
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                _card(
                  title: 'Ask the agent',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DropdownButtonFormField<InventoryBalance>(
                        initialValue: _selected,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Medicine at facility',
                          border: OutlineInputBorder(),
                        ),
                        items: _balances
                            .map((b) => DropdownMenuItem(
                                  value: b,
                                  child: Text(
                                    '${b.medicineName} · ${b.facilityName}',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ))
                            .toList(),
                        onChanged: (b) => setState(() {
                          _selected = b;
                          _stock.text = '${b?.quantityOnHand ?? 0}';
                        }),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _objective,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Objective',
                          helperText: 'A question, not an instruction. Injected commands are refused.',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _stock,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Current stock on hand',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _running || _selected == null ? null : _run_,
                          icon: _running
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.auto_awesome),
                          label: Text(_running ? 'Running agent…' : 'Run agent'),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Color(0xFFDC2626)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(_error!, style: const TextStyle(color: Color(0xFF7F1D1D))),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_run != null) ...[const SizedBox(height: 16), ..._results(_run!)],
              ],
            ),
    );
  }

  List<Widget> _results(Map<String, dynamic> run) {
    final result = Map<String, dynamic>.from(run['result'] as Map? ?? {});
    final findings = (result['findings'] as List? ?? []).cast<Map<String, dynamic>>();
    final recommendations = (result['recommendations'] as List? ?? []).cast<Map<String, dynamic>>();
    final status = '${result['status'] ?? '—'}';
    final confidence = (result['confidence'] as num?)?.toDouble() ?? 0;

    // The model's narrative is separated from the measured findings so a reader can
    // always tell which numbers were computed and which text was written.
    final assessment = findings.where((f) => f['code'] == 'AI_ASSESSMENT').toList();
    final measured = findings.where((f) => f['code'] != 'AI_ASSESSMENT').toList();

    return [
      _card(
        title: 'Agent run',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _chip(status, status == 'SUCCESS' ? const Color(0xFF0F766E) : const Color(0xFFD97706)),
                _chip('confidence ${(confidence * 100).round()}%', const Color(0xFF475569)),
                _chip('${run['intent'] ?? '—'}', const Color(0xFF475569)),
                _chip('${run['durationMs'] ?? 0} ms', const Color(0xFF475569)),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Plan: ${(run['plan'] as List? ?? []).join(' → ')}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
      if (assessment.isNotEmpty) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDFA),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF99F6E4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(Icons.auto_awesome, size: 18, color: Color(0xFF0F766E)),
                  SizedBox(width: 8),
                  Text(
                    'AI assessment',
                    style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF0F766E)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text('${assessment.first['summary']}', style: const TextStyle(height: 1.45)),
              const SizedBox(height: 8),
              const Text(
                'Written by the model from figures the backend computed. Every number is '
                'checked against those figures before it is shown.',
                style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      ],
      const SizedBox(height: 12),
      _card(
        title: 'Findings',
        child: Column(
          children: measured
              .map((f) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          f['code'] == 'SHORTAGE_RISK' ? Icons.warning_amber_rounded : Icons.check_circle_outline,
                          size: 18,
                          color: f['code'] == 'SHORTAGE_RISK'
                              ? const Color(0xFFDC2626)
                              : const Color(0xFF0F766E),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${f['code']}',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                              ),
                              Text('${f['summary']}', style: const TextStyle(height: 1.35)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ))
              .toList(),
        ),
      ),
      if (recommendations.isNotEmpty) ...[
        const SizedBox(height: 12),
        _card(
          title: 'Recommendations',
          child: Column(
            children: recommendations.map((r) {
              final priority = '${r['priority'] ?? 'MEDIUM'}';
              final color = priority == 'HIGH'
                  ? const Color(0xFFDC2626)
                  : priority == 'LOW'
                      ? const Color(0xFF475569)
                      : const Color(0xFFD97706);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _chip(priority, color),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${r['code']}',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('${r['summary']}', style: const TextStyle(height: 1.35)),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Text(
          'Advisory only. The agent approves nothing and changes nothing. Every result '
          'requires human validation before any stock is moved.',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
      ),
    ];
  }

  Widget _card({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFD7E4E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
