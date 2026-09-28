import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../services/transfer_api_service.dart';

class CreateTransferScreen extends StatefulWidget {
  final TransferApiService? apiService;

  const CreateTransferScreen({super.key, this.apiService});

  @override
  State<CreateTransferScreen> createState() => _CreateTransferScreenState();
}

class _CreateTransferScreenState extends State<CreateTransferScreen> {
  late final TransferApiService _apiService;
  final _formKey = GlobalKey<FormState>();

  final _quantityController = TextEditingController(text: '100');
  final _notesController = TextEditingController();

  String _selectedDestinationFacility = AppConstants.defaultDestinationFacilityId;
  String _selectedMedicine = AppConstants.defaultMedicineId;
  String _selectedPriority = 'Urgent';
  bool _autoSubmitForApproval = true;
  bool _isLoading = false;
  String? _errorMessage;

  final Map<String, String> _facilities = {
    'a0000000-0000-0000-0000-000000000003': 'Teaching Hospital Kandy (Central)',
    'a0000000-0000-0000-0000-000000000001': 'National Hospital Colombo (Western)',
    'a0000000-0000-0000-0000-000000000002': 'Karapitiya Teaching Hospital (Southern)',
  };

  final Map<String, String> _medicines = {
    'b0000000-0000-0000-0000-000000000005': 'Ceftriaxone 1g Injection Vials',
    'b0000000-0000-0000-0000-000000000001': 'Amoxicillin 500mg Capsules',
    'b0000000-0000-0000-0000-000000000002': 'Paracetamol 500mg Tablets',
  };

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? TransferApiService();
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _handleCreateShortage() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final quantity = int.parse(_quantityController.text.trim());
      final createdTransfer = await _apiService.createTransfer(
        destinationFacilityId: _selectedDestinationFacility,
        medicineId: _selectedMedicine,
        requestedQuantity: quantity,
        priority: _selectedPriority,
        notes: _notesController.text.trim().isNotEmpty
            ? _notesController.text.trim()
            : 'Field shortage declared by hospital pharmacy technician.',
      );

      if (_autoSubmitForApproval && createdTransfer.status.toLowerCase() == 'draft') {
        await _apiService.submitTransferRequest(createdTransfer.id);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.primary,
            content: Text(
              'Shortage declared successfully! Transfer: ${createdTransfer.transferNumber}',
            ),
          ),
        );
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Declare Field Shortage',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.add_shopping_cart_rounded,
                        color: AppColors.primary,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Field Shortage Declaration',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Instantly initiate redistribution candidate analysis.',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.statusRejected.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.statusRejected.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.statusRejected, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: AppColors.statusRejected, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),

              // Destination Facility
              const Text(
                'Destination Hospital (Shortage Site)',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedDestinationFacility,
                    isExpanded: true,
                    dropdownColor: AppColors.surface,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                    items: _facilities.entries.map((entry) {
                      return DropdownMenuItem<String>(
                        value: entry.key,
                        child: Text(entry.value),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedDestinationFacility = val);
                    },
                  ),
                ),
              ),

              const SizedBox(height: 18),

              // Medicine Selection
              const Text(
                'Medicine Required',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedMedicine,
                    isExpanded: true,
                    dropdownColor: AppColors.surface,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                    items: _medicines.entries.map((entry) {
                      return DropdownMenuItem<String>(
                        value: entry.key,
                        child: Text(entry.value),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedMedicine = val);
                    },
                  ),
                ),
              ),

              const SizedBox(height: 18),

              // Quantity Required
              const Text(
                'Requested Quantity (Doses/Packs)',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _quantityController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 15),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  hintText: 'e.g. 200',
                  hintStyle: const TextStyle(color: AppColors.textMuted),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                  prefixIcon: const Icon(Icons.numbers_rounded, color: AppColors.primary),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Please enter quantity';
                  final num = int.tryParse(val.trim());
                  if (num == null || num <= 0) return 'Must be a positive integer';
                  return null;
                },
              ),

              const SizedBox(height: 18),

              // Priority Level
              const Text(
                'Clinical Urgency / Priority',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: ['Routine', 'Urgent', 'Emergency'].map((p) {
                  final isSelected = _selectedPriority == p;
                  final pColor = AppColors.getPriorityColor(p);
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4.0),
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedPriority = p),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? pColor.withOpacity(0.2) : AppColors.surface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isSelected ? pColor : AppColors.border,
                              width: isSelected ? 2 : 1,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              p,
                              style: TextStyle(
                                color: isSelected ? Colors.white : AppColors.textSecondary,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 18),

              // Clinical Notes
              const Text(
                'Clinical Notes / Reason for Shortage',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _notesController,
                maxLines: 3,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  hintText: 'e.g. ICU pediatric ward stock depleted due to influx...',
                  hintStyle: const TextStyle(color: AppColors.textMuted),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Auto-submit switch
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Submit Immediately for Approval',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            'Transitions transfer from Draft to Requested status.',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: _autoSubmitForApproval,
                      activeThumbColor: AppColors.primary,
                      onChanged: (val) => setState(() => _autoSubmitForApproval = val),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Submit Button
              ElevatedButton(
                onPressed: _isLoading ? null : _handleCreateShortage,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.send_rounded, size: 18, color: Colors.white),
                          SizedBox(width: 8),
                          Text(
                            'Initiate Redistribution Request',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
