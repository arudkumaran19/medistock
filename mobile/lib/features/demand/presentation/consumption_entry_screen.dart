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
///
/// Facility and medicine are chosen from the Inventory catalogue. Both used to be
/// wrong: the medicine was a free-text box the backend tried to bind to a GUID, so
/// typing a name failed with a bare 400, and the facility was fixed to the
/// demonstration facility with no way to change it.
class ConsumptionEntryScreen extends ConsumerStatefulWidget {
  const ConsumptionEntryScreen({super.key});

  static const String routeName = '/demand/consumption/new';

  @override
  ConsumerState<ConsumptionEntryScreen> createState() => _ConsumptionEntryScreenState();
}

class _ConsumptionEntryScreenState extends ConsumerState<ConsumptionEntryScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _quantityController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  String? _facilityId;
  String? _medicineId;
  DateTime _consumptionDate = DateTime.now();

  @override
  void dispose() {
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
          facilityId: _facilityId,
          medicineId: _medicineId!,
          quantityUsed: double.parse(_quantityController.text.trim()),
          consumptionDate: _consumptionDate,
          notes: _notesController.text.trim(),
        );

    if (!mounted) {
      return;
    }

    final ConsumptionEntryState state = ref.read(consumptionEntryControllerProvider);

    if (state.isSuccess) {
      // The history and shortage screens follow the facility just recorded against,
      // so the entry is visible there straight away.
      if (_facilityId != null) {
        ref.read(currentFacilityIdProvider.notifier).state = _facilityId!;
      }

      // The facility is kept: an officer usually records several medicines for the
      // same store in one sitting.
      _formKey.currentState?.reset();
      _quantityController.clear();
      _notesController.clear();
      setState(() => _medicineId = null);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Consumption recorded.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final ConsumptionEntryState state = ref.watch(consumptionEntryControllerProvider);
    final AsyncValue<List<ReferenceOption>> facilities = ref.watch(facilityOptionsProvider);
    final AsyncValue<List<ReferenceOption>> medicines = ref.watch(medicineOptionsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Record consumption')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              _OptionField(
                fieldKey: const Key('facility-field'),
                label: 'Facility',
                options: facilities,
                value: _facilityId,
                validator: ConsumptionEntryValidator.validateFacilityId,
                onChanged: (String? id) => setState(() => _facilityId = id),
              ),
              const SizedBox(height: AppSpacing.md),
              _OptionField(
                fieldKey: const Key('medicine-field'),
                label: 'Medicine',
                options: medicines,
                value: _medicineId,
                validator: ConsumptionEntryValidator.validateMedicineId,
                onChanged: (String? id) => setState(() => _medicineId = id),
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

/// A dropdown over a reference list that is still loading or failed to load.
///
/// While loading or on failure it renders as a disabled field with a helper line,
/// so the form keeps its layout and the officer can see why it cannot be used.
class _OptionField extends StatelessWidget {
  const _OptionField({
    required this.fieldKey,
    required this.label,
    required this.options,
    required this.value,
    required this.validator,
    required this.onChanged,
  });

  final Key fieldKey;
  final String label;
  final AsyncValue<List<ReferenceOption>> options;
  final String? value;
  final String? Function(String?) validator;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final List<ReferenceOption> items = options.valueOrNull ?? const <ReferenceOption>[];

    final String? helper = options.isLoading
        ? 'Loading…'
        : options.hasError
            ? 'Could not load the list. Check the connection and reopen this screen.'
            : null;

    return DropdownButtonFormField<String>(
      key: fieldKey,
      // A selection that is no longer in the list would assert; drop it instead.
      initialValue: items.any((ReferenceOption o) => o.id == value) ? value : null,
      isExpanded: true,
      decoration: InputDecoration(labelText: label, helperText: helper),
      validator: validator,
      items: items
          .map((ReferenceOption option) => DropdownMenuItem<String>(
                value: option.id,
                child: Text(option.name, overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: items.isEmpty ? null : onChanged,
    );
  }
}
