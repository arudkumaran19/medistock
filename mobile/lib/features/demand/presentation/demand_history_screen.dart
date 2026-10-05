import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/shared.dart';
import '../application/demand_providers.dart';
import '../domain/demand_models.dart';

/// Consumption history the officer has recorded, with search.
/// Sathurstiga S. (IT24103156).
class DemandHistoryScreen extends ConsumerStatefulWidget {
  const DemandHistoryScreen({super.key});

  static const String routeName = '/demand/history';

  @override
  ConsumerState<DemandHistoryScreen> createState() => _DemandHistoryScreenState();
}

class _DemandHistoryScreenState extends ConsumerState<DemandHistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  String? _search;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<PagedResponse<ConsumptionRecord>> history =
        ref.watch(consumptionHistoryProvider(_search));
    final DemandActionState action = ref.watch(demandActionsProvider);

    ref.listen<DemandActionState>(demandActionsProvider, (_, DemandActionState next) {
      if (next.errorMessage != null) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(next.errorMessage!)));
        ref.read(demandActionsProvider.notifier).clearError();
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Consumption history')),
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: TextField(
              key: const Key('history-search-field'),
              controller: _searchController,
              decoration: const InputDecoration(
                labelText: 'Search source or notes',
                prefixIcon: Icon(Icons.search),
              ),
              onSubmitted: (String value) {
                setState(() => _search = value.trim().isEmpty ? null : value.trim());
              },
            ),
          ),
          Expanded(
            child: history.when(
              loading: () => const LoadingView(label: 'Loading history…'),
              error: (Object error, StackTrace _) => ErrorView(
                message: error.toString(),
                onRetry: () => ref.invalidate(consumptionHistoryProvider(_search)),
              ),
              data: (PagedResponse<ConsumptionRecord> page) {
                if (page.isEmpty) {
                  return const EmptyView(
                    message: 'No consumption recorded yet.',
                    icon: Icons.history,
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(consumptionHistoryProvider(_search)),
                  child: ListView.separated(
                    itemCount: page.items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (BuildContext context, int index) {
                      final ConsumptionRecord record = page.items[index];

                      return ListTile(
                        title: Text('${record.quantityUsed.toStringAsFixed(0)} units'),
                        subtitle: Text(
                          '${DateFormat('yyyy-MM-dd').format(record.consumptionDate)} · '
                          '${record.source}',
                        ),
                        trailing: PopupMenuButton<String>(
                          key: Key('record-menu-${record.id}'),
                          enabled: !action.isBusy,
                          onSelected: (String choice) {
                            if (choice == 'edit') {
                              _editQuantity(context, ref, record);
                            } else {
                              _confirmDelete(context, ref, record);
                            }
                          },
                          itemBuilder: (BuildContext context) =>
                              <PopupMenuEntry<String>>[
                            const PopupMenuItem<String>(
                              value: 'edit',
                              child: Text('Correct quantity'),
                            ),
                            const PopupMenuItem<String>(
                              value: 'delete',
                              child: Text('Delete'),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  /// Correcting a quantity: the only consumption field a field officer changes.
  Future<void> _editQuantity(
    BuildContext context,
    WidgetRef ref,
    ConsumptionRecord record,
  ) async {
    final String? result = await showDialog<String>(
      context: context,
      builder: (BuildContext context) => _EditQuantityDialog(
        initialQuantity: record.quantityUsed.toStringAsFixed(0),
      ),
    );

    if (result == null) {
      return;
    }

    await ref.read(demandActionsProvider.notifier).updateConsumption(
          record.id,
          ConsumptionEntry(
            facilityId: record.facilityId,
            medicineId: record.medicineId,
            quantityUsed: double.parse(result),
            consumptionDate: record.consumptionDate,
            source: record.source,
            notes: record.notes,
          ),
        );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    ConsumptionRecord record,
  ) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Delete this record?'),
        content: Text(
          'Removing ${record.quantityUsed.toStringAsFixed(0)} units recorded on '
          '${DateFormat('yyyy-MM-dd').format(record.consumptionDate)} changes the '
          'history every later forecast is derived from.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const Key('delete-confirm-button'),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed ?? false) {
      await ref.read(demandActionsProvider.notifier).deleteConsumption(record.id);
    }
  }
}

/// Quantity correction dialog.
///
/// A widget rather than a StatefulBuilder so it owns its TextEditingController and
/// disposes it in its own dispose(). Disposing the controller straight after
/// showDialog returns is too early: the dialog is still rebuilding through its exit
/// animation and throws "A TextEditingController was used after being disposed".
class _EditQuantityDialog extends StatefulWidget {
  const _EditQuantityDialog({required this.initialQuantity});

  final String initialQuantity;

  @override
  State<_EditQuantityDialog> createState() => _EditQuantityDialogState();
}

class _EditQuantityDialogState extends State<_EditQuantityDialog> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialQuantity);

  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    final String? problem = ConsumptionEntryValidator.validateQuantity(_controller.text);

    if (problem != null) {
      setState(() => _error = problem);
      return;
    }

    Navigator.of(context).pop(_controller.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Correct quantity'),
      content: TextField(
        key: const Key('edit-quantity-field'),
        controller: _controller,
        autofocus: true,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(
          labelText: 'Quantity used',
          errorText: _error,
        ),
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          key: const Key('edit-save-button'),
          onPressed: _save,
          child: const Text('Save'),
        ),
      ],
    );
  }
}
