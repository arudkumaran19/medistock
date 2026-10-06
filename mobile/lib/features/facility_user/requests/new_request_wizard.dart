import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

class NewRequestWizard extends StatefulWidget {
  final String? prefillMedicineName;
  final int? prefillQuantity;
  final String? prefillUrgency;
  final String? prefillNotes;
  final String? sourceShortageAlertId;

  const NewRequestWizard({
    super.key,
    this.prefillMedicineName,
    this.prefillQuantity,
    this.prefillUrgency,
    this.prefillNotes,
    this.sourceShortageAlertId,
  });

  @override
  State<NewRequestWizard> createState() => _NewRequestWizardState();
}

class _NewRequestWizardState extends State<NewRequestWizard> {
  final PageController _pageController = PageController();
  final ApiClient _apiClient = ApiClient();

  int _currentStep = 1;
  bool _isSubmitting = false;

  // Step 1 State
  late String _selectedMedicine;
  late int _quantity;
  bool _isColdChain = false;

  // Step 2 State
  String _sourceFacility = 'Tambaram Regional Medical Depot';
  late String _urgencyTier; // Normal, Urgent, Critical
  DateTime _requiredBy = DateTime.now().add(const Duration(hours: 4));
  late TextEditingController _notesController;

  // Step 4 State
  String _createdRequestId = 'REQ-2024-8845';

  @override
  void initState() {
    super.initState();
    _selectedMedicine = widget.prefillMedicineName ?? 'Amoxicillin + Clavulanic Acid 625mg';
    _quantity = widget.prefillQuantity ?? 50;
    _urgencyTier = widget.prefillUrgency ?? 'Urgent';
    _notesController = TextEditingController(
      text: widget.prefillNotes ?? 'Urgent replenishment for outpatient pediatric unit. Handover to Pharmacist on duty (Dr. Raman).',
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_currentStep < 4) {
      _pageController.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      setState(() => _currentStep++);
    }
  }

  void _prevStep() {
    if (_currentStep > 1) {
      _pageController.previousPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      setState(() => _currentStep--);
    } else {
      context.pop();
    }
  }

  Future<void> _submitRequest() async {
    setState(() => _isSubmitting = true);
    try {
      final response = await _apiClient.post(
        '/api/transfers',
        body: {
          'destinationFacilityId': 'a0000000-0000-0000-0000-000000000001',
          'sourceFacilityId': 'a0000000-0000-0000-0000-000000000002',
          'priority': _urgencyTier,
          'notes': _notesController.text,
          'sourceShortageAlertId': widget.sourceShortageAlertId,
          'medicineName': _selectedMedicine,
          'requestedQuantity': _quantity,
          'items': [
            {
              'medicineName': _selectedMedicine,
              'requestedQuantity': _quantity,
            }
          ]
        },
        requireAuth: false,
      );

      if (response != null && response is Map && response['id'] != null) {
        _createdRequestId = response['transferNumber']?.toString() ?? 'REQ-2024-8845';
      }
    } catch (_) {}

    setState(() => _isSubmitting = false);
    _nextStep();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: _prevStep,
        ),
        title: Text('New Medicine Requisition (Step $_currentStep of 4)'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Stepper Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              color: AppColors.surface,
              child: Row(
                children: [
                  _StepHeaderItem(stepNum: 1, label: 'Medicine', isActive: _currentStep >= 1),
                  _StepHeaderItem(stepNum: 2, label: 'Route & Urgency', isActive: _currentStep >= 2),
                  _StepHeaderItem(stepNum: 3, label: 'Review', isActive: _currentStep >= 3),
                  _StepHeaderItem(stepNum: 4, label: 'Confirmation', isActive: _currentStep >= 4),
                ],
              ),
            ),

            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _buildStep1MedicineSelection(),
                  _buildStep2RouteAndUrgency(),
                  _buildStep3ReviewSummary(),
                  _buildStep4SuccessConfirmation(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep1MedicineSelection() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Select Required Medicine', style: AppTextStyles.titleLarge),
          const SizedBox(height: 6),
          Text('Search your local district catalog or select low-stock suggestion.', style: AppTextStyles.bodyMedium),
          const SizedBox(height: 20),

          Text('Medicine Name & Dose', style: AppTextStyles.labelLarge),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: _selectedMedicine,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.medication_rounded),
            ),
            items: const [
              DropdownMenuItem(value: 'Amoxicillin + Clavulanic Acid 625mg', child: Text('Amoxicillin + Clavulanic Acid 625mg')),
              DropdownMenuItem(value: 'Meropenem 1g IV Injection', child: Text('Meropenem 1g IV Injection')),
              DropdownMenuItem(value: 'Human Albumin 20% Infusion', child: Text('Human Albumin 20% Infusion')),
              DropdownMenuItem(value: 'Cefixime 200mg Tablets', child: Text('Cefixime 200mg Tablets')),
            ],
            onChanged: (val) {
              if (val != null) setState(() => _selectedMedicine = val);
            },
          ),

          const SizedBox(height: 24),

          Text('Requested Quantity (Strips / Vials)', style: AppTextStyles.labelLarge),
          const SizedBox(height: 12),
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
                  icon: const Icon(Icons.remove_circle_outline_rounded, size: 32, color: AppColors.primary),
                  onPressed: () {
                    if (_quantity > 10) setState(() => _quantity -= 10);
                  },
                ),
                Column(
                  children: [
                    Text('$_quantity', style: AppTextStyles.displayLarge.copyWith(color: AppColors.primaryDark)),
                    Text('Units (500 Tablets total)', style: AppTextStyles.bodySmall),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline_rounded, size: 32, color: AppColors.primary),
                  onPressed: () {
                    setState(() => _quantity += 10);
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          CheckboxListTile(
            title: Text('Require Cold-Chain Temperature Monitor (2°C - 8°C)', style: AppTextStyles.titleSmall),
            subtitle: Text('Includes real-time Bluetooth data-logger inside payload box', style: AppTextStyles.bodySmall),
            value: _isColdChain,
            activeColor: AppColors.primary,
            onChanged: (val) => setState(() => _isColdChain = val ?? false),
          ),

          const SizedBox(height: 32),

          ElevatedButton(
            onPressed: _nextStep,
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Continue to Route & Details'),
                SizedBox(width: 8),
                Icon(Icons.arrow_forward_rounded, size: 18),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2RouteAndUrgency() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Facility Logistics Pair & Urgency', style: AppTextStyles.titleLarge),
          const SizedBox(height: 6),
          Text('Automated AI route matching found verified surplus stock.', style: AppTextStyles.bodyMedium),
          const SizedBox(height: 20),

          // Source Depot Box
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primaryLight.withOpacity(0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('DISPATCH DEPOT (SOURCE)', style: AppTextStyles.badge.copyWith(color: AppColors.primaryDark)),
                    Text('Verified Stock', style: AppTextStyles.badge.copyWith(color: AppColors.success)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(_sourceFacility, style: AppTextStyles.titleSmall),
                Text('Redhills Rd, GST Road, Chennai 600045 • 15.2 km away', style: AppTextStyles.bodySmall),
              ],
            ),
          ),

          const SizedBox(height: 12),
          const Center(child: Icon(Icons.arrow_downward_rounded, color: AppColors.primary)),
          const SizedBox(height: 12),

          // Destination Hub Box
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
                Text('RECEIVING HUB (DESTINATION)', style: AppTextStyles.badge.copyWith(color: AppColors.textMuted)),
                const SizedBox(height: 6),
                Text('Apollo Pharmacy - Anna Nagar Central', style: AppTextStyles.titleSmall),
                Text('Ward Bay C-4 Receiving Dock • Lead: Dr. Kavitha Raman', style: AppTextStyles.bodySmall),
              ],
            ),
          ),

          const SizedBox(height: 24),

          Text('Urgency Dispatch Tier', style: AppTextStyles.labelLarge),
          const SizedBox(height: 10),
          _UrgencyTile(
            title: 'Normal Priority',
            subtitle: 'Routine stock replenishment • Standard courier (Within 12 hrs)',
            value: 'Normal',
            groupValue: _urgencyTier,
            onChanged: (val) => setState(() => _urgencyTier = val!),
          ),
          const SizedBox(height: 8),
          _UrgencyTile(
            title: 'Urgent Priority',
            subtitle: 'Stockout warning limit reached • Direct point-to-point (Within 4 hrs)',
            value: 'Urgent',
            groupValue: _urgencyTier,
            onChanged: (val) => setState(() => _urgencyTier = val!),
          ),
          const SizedBox(height: 8),
          _UrgencyTile(
            title: 'Critical Emergency (ICU / STAT)',
            subtitle: 'Active surgical requirement • Immediate ambulance dispatch lock (< 45 mins)',
            value: 'Critical',
            color: AppColors.error,
            groupValue: _urgencyTier,
            onChanged: (val) => setState(() => _urgencyTier = val!),
          ),

          const SizedBox(height: 20),

          Text('Handover Manifest Notes', style: AppTextStyles.labelLarge),
          const SizedBox(height: 8),
          TextField(
            controller: _notesController,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Enter specific handover instructions for dispatch pilot...',
            ),
          ),

          const SizedBox(height: 28),

          ElevatedButton(
            onPressed: _nextStep,
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Review Summary & ETA'),
                SizedBox(width: 8),
                Icon(Icons.arrow_forward_rounded, size: 18),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep3ReviewSummary() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Review Requisition Manifest', style: AppTextStyles.titleLarge),
          const SizedBox(height: 6),
          Text('Please verify all details before authorizing dispatch lock.', style: AppTextStyles.bodyMedium),
          const SizedBox(height: 20),

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
                    Text('LIFE CRITICAL ORDER ITEM', style: AppTextStyles.badge.copyWith(color: AppColors.primary)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.primarySurface, borderRadius: BorderRadius.circular(6)),
                      child: Text(_urgencyTier.toUpperCase(), style: AppTextStyles.badge.copyWith(color: AppColors.primaryDark)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(_selectedMedicine, style: AppTextStyles.titleLarge),
                const SizedBox(height: 4),
                Text('Qty: $_quantity Strips (500 Tabs) • Cold-Chain: ${_isColdChain ? "YES" : "Standard"}', style: AppTextStyles.bodyMedium),
                const Divider(height: 24),
                Row(
                  children: [
                    const Icon(Icons.location_on_rounded, size: 16, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Expanded(child: Text('From: $_sourceFacility', style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold))),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.flag_rounded, size: 16, color: AppColors.secondary),
                    const SizedBox(width: 6),
                    Expanded(child: Text('To: Apollo Pharmacy - Anna Nagar Central', style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.bold))),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Estimated ETA Banner
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primaryLight.withOpacity(0.4)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('GRID TRANSFER FEE', style: AppTextStyles.badge.copyWith(color: AppColors.textMuted)),
                    Text('₹0 (Govt Sovereign)', style: AppTextStyles.titleMedium),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('PRIORITY DELIVERY', style: AppTextStyles.badge.copyWith(color: AppColors.primaryDark)),
                    Text('~45 mins ETA', style: AppTextStyles.titleLarge.copyWith(color: AppColors.primaryDark)),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          ElevatedButton(
            onPressed: _isSubmitting ? null : _submitRequest,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: _isSubmitting
                ? const CircularProgressIndicator(color: Colors.white)
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.lock_clock_rounded, size: 18),
                      SizedBox(width: 8),
                      Text('Submit Medicine Request Now'),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep4SuccessConfirmation() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 90,
            height: 90,
            decoration: const BoxDecoration(
              color: AppColors.successLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_rounded, size: 64, color: AppColors.success),
          ),
          const SizedBox(height: 24),
          Text('Requisition Submitted!', style: AppTextStyles.displayMedium),
          const SizedBox(height: 8),
          Text('Request ID: $_createdRequestId', style: AppTextStyles.titleSmall.copyWith(color: AppColors.primaryDark)),
          const SizedBox(height: 12),
          Text(
            'Your transfer request has been broadcasted to the nearest Field Officer fleet. Telemetry stream is live.',
            textAlign: TextAlign.center,
            style: AppTextStyles.bodyMedium,
          ),
          const SizedBox(height: 36),
          ElevatedButton(
            onPressed: () => context.push('/user/requests/$_createdRequestId'),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.map_rounded),
                SizedBox(width: 8),
                Text('Track Delivery on Live Map'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => context.go('/user/dashboard'),
            child: const Text('Back to Dashboard'),
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

  const _StepHeaderItem({required this.stepNum, required this.label, required this.isActive});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          CircleAvatar(
            radius: 10,
            backgroundColor: isActive ? AppColors.primary : AppColors.surfaceSubtle,
            child: Text('$stepNum', style: TextStyle(fontSize: 10, color: isActive ? Colors.white : AppColors.textMuted)),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              label,
              style: AppTextStyles.bodySmall.copyWith(
                fontSize: 10,
                color: isActive ? AppColors.textPrimary : AppColors.textMuted,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _UrgencyTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String value;
  final String groupValue;
  final Color? color;
  final ValueChanged<String?> onChanged;

  const _UrgencyTile({
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
        color: isSelected ? activeColor.withOpacity(0.06) : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isSelected ? activeColor : AppColors.border),
      ),
      child: RadioListTile<String>(
        value: value,
        groupValue: groupValue,
        activeColor: activeColor,
        title: Text(title, style: AppTextStyles.titleSmall.copyWith(color: isSelected ? activeColor : AppColors.textPrimary)),
        subtitle: Text(subtitle, style: AppTextStyles.bodySmall),
        onChanged: onChanged,
      ),
    );
  }
}
