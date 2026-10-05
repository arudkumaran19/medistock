import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/shared.dart';
import '../application/demand_providers.dart';

/// Records medicine consumption in the field.
/// Sathurstiga S. (IT24103156).
///
/// Flutter is the operational application: look up, scan, update, request, receive,
/// track, notify. This screen is the "update" step and the first stage of the chain
/// consumption -> forecast -> projected stockout -> shortage alert.
class ConsumptionEntryScreen extends ConsumerStatefulWidget {
  const ConsumptionEntryScreen({super.key});

  static const String routeName = '/demand/consumption/new';

  @override
  ConsumerState<ConsumptionEntryScreen> createState() => _ConsumptionEntryScreenState();
}

class _ConsumptionEntryScreenState extends ConsumerState<ConsumptionEntryScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _medicineController = TextEditingController();
  final TextEditingController _quantityController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  DateTime _consumptionDate = DateTime.now();

  @override
  void dispose() {
    _medicineController.dispose();
    _quantityController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final DateTime now = DateTime.now();

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _consumptionDate,
      firstDate: now.subtract(const Duration(days: 365)),
      // Consumption records what has already been used, so today is the latest date.
      lastDate: now,
    );

    if (picked != null) {
      setState(() => _consumptionDate = picked);
    }
  }

  Future<void> _submit() async {
    final String? dateError = ConsumptionEntryValidator.validateDate(_consumptionDate);

    if (dateError != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(dateError)));
      return;
    }

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    await ref.read(consumptionEntryControllerProvider.notifier).submit(
          medicineId: _medicineController.text.trim(),
          quantityUsed: double.parse(_quantityController.text.trim()),
          consumptionDate: _consumptionDate,
          notes: _notesController.text.trim(),
        );

    if (!mounted) {
      return;
    }

    final ConsumptionEntryState state = ref.read(consumptionEntryControllerProvider);

    if (state.isSuccess) {
      _formKey.currentState?.reset();
      _medicineController.clear();
      _quantityController.clear();
      _notesController.clear();

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Consumption recorded.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final ConsumptionEntryState state = ref.watch(consumptionEntryControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Record consumption')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                key: const Key('medicine-field'),
                controller: _medicineController,
                decoration: const InputDecoration(labelText: 'Medicine'),
                validator: ConsumptionEntryValidator.validateMedicineId,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                key: const Key('quantity-field'),
                controller: _quantityController,
                decoration: const InputDecoration(labelText: 'Quantity used'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: ConsumptionEntryValidator.validateQuantity,
              ),
              const SizedBox(height: AppSpacing.md),
              InputDecorator(
                decoration: const InputDecoration(labelText: 'Date used'),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    Text(DateFormat('yyyy-MM-dd').format(_consumptionDate)),
                    TextButton(
                      key: const Key('pick-date-button'),
                      onPressed: _pickDate,
                      child: const Text('Change'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                key: const Key('notes-field'),
                controller: _notesController,
                decoration: const InputDecoration(labelText: 'Notes (optional)'),
                maxLines: 3,
                validator: ConsumptionEntryValidator.validateNotes,
              ),
              const SizedBox(height: AppSpacing.lg),
              if (state.errorMessage != null) ...<Widget>[
                Text(
                  state.errorMessage!,
                  key: const Key('entry-error'),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              FilledButton(
                key: const Key('submit-button'),
                onPressed: state.isSubmitting ? null : _submit,
                child: Text(state.isSubmitting ? 'Saving…' : 'Record consumption'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
