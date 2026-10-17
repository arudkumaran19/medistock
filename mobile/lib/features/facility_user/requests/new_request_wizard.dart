import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../auth/presentation/auth_controller.dart';
import 'data/transfer_repository.dart';

class NewRequestWizard extends ConsumerStatefulWidget {
  final String? prefillMedicineId;
  final String? prefillMedicineName;
  final String? prefillDestinationFacilityId;
  final int? prefillQuantity;
  final String? prefillUrgency;
  final String? prefillNotes;
  final String? sourceShortageAlertId;
  final ApiClient? apiClient;

  const NewRequestWizard({
    super.key,
    this.prefillMedicineId,
    this.prefillMedicineName,
    this.prefillDestinationFacilityId,
    this.prefillQuantity,
    this.prefillUrgency,
    this.prefillNotes,
    this.sourceShortageAlertId,
    this.apiClient,
  });

  @override
  ConsumerState<NewRequestWizard> createState() => _NewRequestWizardState();
}

class MedicineOption {
  final String id;
  final String name;
  final String code;
  final String unit;

  MedicineOption({
    required this.id,
    required this.name,
    required this.code,
    required this.unit,
  });

  factory MedicineOption.fromJson(Map<String, dynamic> json) {
    return MedicineOption(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      unit: json['unit']?.toString() ?? 'units',
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MedicineOption &&
          runtimeType == other.runtimeType &&
          id.toLowerCase() == other.id.toLowerCase();

  @override
  int get hashCode => id.toLowerCase().hashCode;
}

class _NewRequestWizardState extends ConsumerState<NewRequestWizard> {
  late final ApiClient _apiClient;

  int _currentStep = 1;
  bool _isSubmitting = false;
  bool _isLoadingMedicines = true;
  String? _errorMessage;

  List<MedicineOption> _availableMedicines = [];
  MedicineOption? _selectedMedicine;
  late int _quantity;
  late String _urgencyTier; // Routine, Urgent, Emergency
  late TextEditingController _quantityController;
  late TextEditingController _notesController;

  String? _createdTransferNumber;
  String? _createdTransferId;

  @override
  void initState() {
    super.initState();
    _apiClient = widget.apiClient ?? ApiClient();
    _quantity = widget.prefillQuantity ?? 50;
    if (_quantity <= 0) _quantity = 50;
    final rawUrgency = widget.prefillUrgency?.trim();
    if (rawUrgency == 'Critical' || rawUrgency == 'Emergency') {
      _urgencyTier = 'Emergency';
    } else if (rawUrgency == 'Normal' ||
        rawUrgency == 'Routine' ||
        rawUrgency == 'Low') {
      _urgencyTier = 'Routine';
    } else {
      _urgencyTier = 'Urgent';
    }
    _quantityController = TextEditingController(text: '$_quantity');
    _notesController = TextEditingController(
      text: widget.prefillNotes ??
          'Replenishment request submitted for facility inventory.',
    );

    if (widget.prefillMedicineId != null &&
        widget.prefillMedicineId!.isNotEmpty) {
      final initialMedicine = MedicineOption(
        id: widget.prefillMedicineId!,
        name: widget.prefillMedicineName ?? 'Selected Medicine',
        code: '',
        unit: 'units',
      );
      _selectedMedicine = initialMedicine;
      _availableMedicines = [initialMedicine];
      _isLoadingMedicines = false;
    }

    _loadMedicines();
  }

  Future<void> _loadMedicines() async {
    setState(() {
      if (_availableMedicines.isEmpty) {
        _isLoadingMedicines = true;
      }
      _errorMessage = null;
    });

    try {
      final res = await _apiClient
          .get('/api/medicines', requireAuth: false)
          .timeout(const Duration(seconds: 2));
      List rawList = [];
      if (res is Map && res['data'] is List) {
        rawList = res['data'] as List;
      } else if (res is List) {
        rawList = res;
      }

      final medicines = rawList
          .map((item) => MedicineOption.fromJson(item as Map<String, dynamic>))
          .where((m) => m.name.isNotEmpty)
          .toList();

      if (medicines.isNotEmpty) {
        _availableMedicines = medicines;
      } else if (_availableMedicines.isEmpty) {
        _errorMessage = 'No medicines returned from catalog.';
        _availableMedicines = [];
      }
    } catch (e) {
      if (_availableMedicines.isEmpty) {
        _errorMessage =
            'Failed to load medicines: ${e.toString().replaceAll("Exception: ", "")}';
        _availableMedicines = [];
      }
    }

    // Match prefill medicine
    MedicineOption? matched;
    if (widget.prefillMedicineId != null &&
        widget.prefillMedicineId!.isNotEmpty) {
      matched = _availableMedicines
          .where((m) =>
              m.id.toLowerCase() == widget.prefillMedicineId!.toLowerCase())
          .firstOrNull;
    } else if (widget.prefillMedicineName != null &&
        widget.prefillMedicineName!.isNotEmpty) {
      final query = widget.prefillMedicineName!.toLowerCase();
      matched = _availableMedicines
          .where((m) =>
              m.name.toLowerCase().contains(query) ||
              query.contains(m.name.toLowerCase()))
          .firstOrNull;
    }

    if (matched != null) {
      _selectedMedicine = matched;
    } else if (_selectedMedicine != null) {
      if (!_availableMedicines.any(
          (m) => m.id.toLowerCase() == _selectedMedicine!.id.toLowerCase())) {
        _availableMedicines.insert(0, _selectedMedicine!);
      }
    } else {
      _selectedMedicine = _availableMedicines.firstOrNull;
    }

    if (mounted) {
      setState(() {
        _isLoadingMedicines = false;
      });
    }
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _goToStep(int step) {
    if (step == 2 && (_selectedMedicine == null || _quantity <= 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content:
                Text('Please select a valid medicine and positive quantity.')),
      );
      return;
    }

    setState(() => _currentStep = step);
  }

  Future<void> _submitRequest() async {
    if (_selectedMedicine == null) return;
    if (_quantity <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Requested quantity must be greater than zero.')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final user = ref.read(authControllerProvider).user;
      final destinationFacilityId =
          widget.prefillDestinationFacilityId ?? user?.facilityId;

      if (destinationFacilityId == null ||
          destinationFacilityId.trim().isEmpty) {
        setState(() {
          _isSubmitting = false;
          _errorMessage =
              'Cannot submit: No destination facility found. Please ensure your user profile is assigned to a facility or launch the request from an active shortage alert.';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Cannot submit: No facility assigned to user or alert.'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }

      final repo = ref.read(transferRepositoryProvider);

      // 1. Create Draft Transfer
      final createReq = CreateTransferRequest(
        destinationFacilityId: destinationFacilityId,
        medicineId: _selectedMedicine!.id,
        medicineName: _selectedMedicine!.name,
        requestedQuantity: _quantity,
        priority: _urgencyTier,
        notes: _notesController.text.trim(),
        sourceShortageAlertId: widget.sourceShortageAlertId,
        items: [
          {
            'medicineId': _selectedMedicine!.id,
            'medicineName': _selectedMedicine!.name,
            'requestedQuantity': _quantity,
            'unitOfMeasure': _selectedMedicine!.unit,
          }
        ],
      );

      final created = await repo.createRequest(createReq);
      final transferId = created.id;

      // 2. Formally Submit Transfer Request (advances to Requested and triggers candidate search to Proposed)
      final submitted =
          await repo.submitRequest(transferId, _notesController.text.trim());

      setState(() {
        _createdTransferId = transferId;
        _createdTransferNumber = submitted.transferNumber.isNotEmpty
            ? submitted.transferNumber
            : created.transferNumber;
        _isSubmitting = false;
        _currentStep = 3; // Success state
      });

      // Invalidate requests provider so list updates
      ref.invalidate(myRequestsProvider);
    } catch (e) {
      setState(() {
        _isSubmitting = false;
        _errorMessage =
            'Failed to submit requisition: ${e.toString().replaceAll("Exception: ", "")}';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(_errorMessage ?? 'An error occurred during submission.'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (_currentStep == 2) {
              _goToStep(1);
            } else {
              context.pop();
            }
          },
        ),
        title: Text(_currentStep <= 2
            ? 'New Medicine Requisition (Step $_currentStep of 2)'
            : 'Requisition Submitted'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 2-Step Header Indicator
            if (_currentStep <= 2)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                color: AppColors.surface,
                child: Row(
                  children: [
                    _StepHeaderItem(
                        stepNum: 1,
                        label: 'Medicine & Quantity',
                        isActive: _currentStep >= 1),
                    Container(
                        width: 32,
                        height: 2,
                        color: _currentStep >= 2
                            ? AppColors.primary
                            : AppColors.border),
                    _StepHeaderItem(
                        stepNum: 2,
                        label: 'Review & Submit',
                        isActive: _currentStep >= 2),
                  ],
                ),
              ),

            Expanded(
              child: _isLoadingMedicines && _availableMedicines.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _currentStep == 3
                      ? _buildSuccessView()
                      : _currentStep == 2
                          ? _buildStep2ReviewAndConfirm()
                          : _buildStep1MedicineAndQuantity(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep1MedicineAndQuantity() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Select Required Medicine', style: AppTextStyles.titleLarge),
          const SizedBox(height: 6),
          Text(
              'Choose from the official medicine catalog and specify requested quantity.',
              style: AppTextStyles.bodyMedium),
          const SizedBox(height: 20),
          if (_errorMessage != null && _availableMedicines.isEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.error),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: AppColors.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_errorMessage!,
                        style: AppTextStyles.bodySmall
                            .copyWith(color: AppColors.error)),
                  ),
                  TextButton(
                    onPressed: _loadMedicines,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          Text('Medicine Name & Specification',
              style: AppTextStyles.labelLarge),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<MedicineOption>(
                isExpanded: true,
                value: _selectedMedicine,
                dropdownColor: AppColors.surface,
                items: _availableMedicines.map((med) {
                  return DropdownMenuItem<MedicineOption>(
                    value: med,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            med.name,
                            style: AppTextStyles.titleSmall,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primarySurface,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(med.code,
                              style: AppTextStyles.badge
                                  .copyWith(color: AppColors.primaryDark)),
                        ),
                      ],
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedMedicine = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text('Requested Quantity (${_selectedMedicine?.unit ?? "units"})',
              style: AppTextStyles.labelLarge),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline_rounded,
                      size: 36, color: AppColors.primary),
                  onPressed: () {
                    if (_quantity > 10) {
                      setState(() {
                        _quantity -= 10;
                        _quantityController.text = '$_quantity';
                      });
                    } else if (_quantity > 1) {
                      setState(() {
                        _quantity -= 1;
                        _quantityController.text = '$_quantity';
                      });
                    }
                  },
                ),
                Expanded(
                  child: Column(
                    children: [
                      SizedBox(
                        width: 120,
                        child: TextField(
                          controller: _quantityController,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.displayMedium
                              .copyWith(color: AppColors.primaryDark),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                          ),
                          onChanged: (val) {
                            final parsed = int.tryParse(val);
                            if (parsed != null && parsed > 0) {
                              setState(() => _quantity = parsed);
                            }
                          },
                        ),
                      ),
                      Text('${_selectedMedicine?.unit ?? "Units"} Required',
                          style: AppTextStyles.bodySmall),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline_rounded,
                      size: 36, color: AppColors.primary),
                  onPressed: () {
                    setState(() {
                      _quantity += 10;
                      _quantityController.text = '$_quantity';
                    });
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text('Clinical Urgency Tier', style: AppTextStyles.labelLarge),
          const SizedBox(height: 10),
          _UrgencyOptionTile(
            title: 'Routine Priority',
            subtitle: 'Standard redistribution schedule (Low risk buffer)',
            value: 'Routine',
            groupValue: _urgencyTier,
            onChanged: (val) => setState(() => _urgencyTier = val!),
          ),
          const SizedBox(height: 8),
          _UrgencyOptionTile(
            title: 'Urgent Priority',
            subtitle: 'Stockout projected within supplier lead time',
            value: 'Urgent',
            color: AppColors.warning,
            groupValue: _urgencyTier,
            onChanged: (val) => setState(() => _urgencyTier = val!),
          ),
          const SizedBox(height: 8),
          _UrgencyOptionTile(
            title: 'Emergency Priority',
            subtitle: 'Immediate critical shortage for active clinical ward',
            value: 'Emergency',
            color: AppColors.error,
            groupValue: _urgencyTier,
            onChanged: (val) => setState(() => _urgencyTier = val!),
          ),
          const SizedBox(height: 24),
          Text('Requisition Notes & Justification',
              style: AppTextStyles.labelLarge),
          const SizedBox(height: 8),
          TextField(
            controller: _notesController,
            maxLines: 2,
            decoration: const InputDecoration(
              hintText:
                  'Enter clinical justification or receiving unit notes...',
            ),
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () => _goToStep(2),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Continue to Review'),
                SizedBox(width: 8),
                Icon(Icons.arrow_forward_rounded, size: 18),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2ReviewAndConfirm() {
    final user = ref.watch(authControllerProvider).user;
    final hasDest = (widget.prefillDestinationFacilityId != null &&
            widget.prefillDestinationFacilityId!.isNotEmpty) ||
        (user?.facilityId != null && user!.facilityId!.isNotEmpty);
    final destFacility = user?.facilityName ??
        (widget.prefillDestinationFacilityId != null
            ? 'Alert Assigned Facility'
            : 'Not available');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Review & Confirm Requisition', style: AppTextStyles.titleLarge),
          const SizedBox(height: 6),
          Text(
              'Verify details before submitting to the AI Redistribution Engine.',
              style: AppTextStyles.bodyMedium),
          const SizedBox(height: 20),

          // Medicine & Requisition Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('REQUEST ITEM',
                        style: AppTextStyles.badge
                            .copyWith(color: AppColors.primary)),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _urgencyTier == 'Emergency'
                            ? AppColors.errorLight
                            : _urgencyTier == 'Urgent'
                                ? AppColors.warningLight
                                : AppColors.primarySurface,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _urgencyTier.toUpperCase(),
                        style: AppTextStyles.badge.copyWith(
                          color: _urgencyTier == 'Emergency'
                              ? AppColors.error
                              : _urgencyTier == 'Urgent'
                                  ? AppColors.warning
                                  : AppColors.primaryDark,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(_selectedMedicine?.name ?? '',
                    style: AppTextStyles.titleLarge),
                const SizedBox(height: 4),
                Text(
                    'Code: ${_selectedMedicine?.code ?? ""} • Requested: $_quantity ${_selectedMedicine?.unit ?? "units"}',
                    style: AppTextStyles.bodyMedium),
                const Divider(height: 24),

                // Destination info
                Row(
                  children: [
                    const Icon(Icons.location_on_rounded,
                        size: 18, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Receiving Facility',
                              style: AppTextStyles.bodySmall),
                          Text(destFacility, style: AppTextStyles.titleSmall),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // AI Candidate Proposer Info Banner
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(16),
              border:
                  Border.all(color: AppColors.primaryLight.withOpacity(0.5)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.auto_awesome_rounded,
                    color: AppColors.primaryDark, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Automated Source Facility Matching',
                        style: AppTextStyles.titleSmall
                            .copyWith(color: AppColors.primaryDark),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Source facility is not hardcoded. The Redistribution Planning Agent will automatically discover regional surplus stock and propose the optimal supplying facility.',
                        style: AppTextStyles.bodySmall
                            .copyWith(color: AppColors.primaryDark),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Notes Card
          if (_notesController.text.trim().isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Manifest Notes',
                      style: AppTextStyles.bodySmall
                          .copyWith(color: AppColors.textMuted)),
                  const SizedBox(height: 4),
                  Text(_notesController.text.trim(),
                      style: AppTextStyles.bodyMedium),
                ],
              ),
            ),

          if (!hasDest)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.errorLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      color: AppColors.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'No receiving facility assigned to your user account or alert. Submission is blocked.',
                      style: AppTextStyles.bodySmall
                          .copyWith(color: AppColors.error),
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 16),

          ElevatedButton(
            onPressed: (_isSubmitting || !hasDest) ? null : _submitRequest,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: _isSubmitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.send_rounded, size: 18),
                      SizedBox(width: 8),
                      Text('Submit Transfer Request'),
                    ],
                  ),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _isSubmitting ? null : () => _goToStep(1),
            child: const Text('Back to Edit Details'),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessView() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: AppColors.successLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_rounded,
                size: 54, color: AppColors.success),
          ),
          const SizedBox(height: 20),
          Text('Requisition Submitted!', style: AppTextStyles.displayMedium),
          const SizedBox(height: 8),
          Text(
            'Transfer #: ${_createdTransferNumber ?? ""}',
            style: AppTextStyles.titleMedium.copyWith(
                color: AppColors.primaryDark, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Text(
            'Your requisition has been submitted and is in Proposed status. Regional managers and planning agents will assign dispatch logistics shortly.',
            textAlign: TextAlign.center,
            style: AppTextStyles.bodyMedium,
          ),
          const SizedBox(height: 36),
          ElevatedButton(
            onPressed: () {
              if (_createdTransferId != null) {
                context.push('/user/requests/$_createdTransferId');
              } else {
                context.go('/user/requests');
              }
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.map_rounded),
                SizedBox(width: 8),
                Text('Track Request Details'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => context.go('/user/requests'),
            child: const Text('View All Requisitions'),
          ),
        ],
      ),
    );
  }
}

class _StepHeaderItem extends StatelessWidget {
  final int stepNum;
  final String label;
  final bool isActive;

  const _StepHeaderItem(
      {required this.stepNum, required this.label, required this.isActive});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 12,
          backgroundColor:
              isActive ? AppColors.primary : AppColors.surfaceSubtle,
          child: Text(
            '$stepNum',
            style: TextStyle(
                fontSize: 11,
                color: isActive ? Colors.white : AppColors.textMuted,
                fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: AppTextStyles.bodyMedium.copyWith(
            color: isActive ? AppColors.textPrimary : AppColors.textMuted,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ],
    );
  }
}

class _UrgencyOptionTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String value;
  final String groupValue;
  final Color? color;
  final ValueChanged<String?> onChanged;

  const _UrgencyOptionTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.groupValue,
    this.color,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isSelected = value == groupValue;
    final activeColor = color ?? AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        color: isSelected ? activeColor.withOpacity(0.08) : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isSelected ? activeColor : AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: RadioListTile<String>(
          value: value,
          groupValue: groupValue,
          activeColor: activeColor,
          title: Text(title,
              style: AppTextStyles.titleSmall.copyWith(
                  color: isSelected ? activeColor : AppColors.textPrimary)),
          subtitle: Text(subtitle, style: AppTextStyles.bodySmall),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
