import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

class ReplenishmentRequestsScreen extends StatefulWidget {
  final String baseUrl;
  final String? authToken;

  const ReplenishmentRequestsScreen({
    super.key,
    this.baseUrl = 'http://localhost:5050',
    this.authToken,
  });

  @override
  State<ReplenishmentRequestsScreen> createState() => _ReplenishmentRequestsScreenState();
}

class _ReplenishmentRequestsScreenState extends State<ReplenishmentRequestsScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  List<dynamic> _requests = [];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final uri = Uri.parse('${widget.baseUrl}/api/procurement/replenishment-requests');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (widget.authToken != null) 'Authorization': 'Bearer ${widget.authToken}',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = data['data'] as List<dynamic>? ?? [];
        setState(() {
          _requests = list;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Failed to load replenishment requests (${response.statusCode})';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _createPO(String requestId) async {
    try {
      final uri = Uri.parse('${widget.baseUrl}/api/procurement/replenishment-requests/$requestId/create-po');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (widget.authToken != null) 'Authorization': 'Bearer ${widget.authToken}',
        },
        body: json.encode({
          'unitPrice': 45.0,
          'notes': 'Purchase Order auto-generated from Replenishment Request',
        }),
      );

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Purchase Order created successfully!'), backgroundColor: AppColors.success),
        );
        _fetchRequests();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create PO: ${response.body}'), backgroundColor: AppColors.error),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Procurement Replenishments'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchRequests,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: const TextStyle(color: AppColors.error)))
              : _requests.isEmpty
                  ? const Center(child: Text('No pending replenishment requests.'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _requests.length,
                      itemBuilder: (context, index) {
                        final req = _requests[index];
                        final status = req['status']?.toString() ?? 'PendingPO';
                        final isFulfilled = status == 'PO_CREATED';

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      req['medicineName']?.toString() ?? 'Medicine Replenishment',
                                      style: AppTextStyles.titleMedium,
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: isFulfilled ? AppColors.successLight : AppColors.warningLight,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        status,
                                        style: AppTextStyles.badge.copyWith(
                                          color: isFulfilled ? AppColors.success : AppColors.warning,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Facility: ${req['facilityName'] ?? req['facilityId']}',
                                  style: AppTextStyles.bodyMedium,
                                ),
                                Text(
                                  'Quantity Required: ${req['requestedQuantity']} units',
                                  style: AppTextStyles.bodySmall,
                                ),
                                Text(
                                  'Reason: ${req['reason']}',
                                  style: AppTextStyles.bodySmall.copyWith(color: AppColors.textMuted),
                                ),
                                const SizedBox(height: 12),
                                if (!isFulfilled)
                                  ElevatedButton.icon(
                                    onPressed: () => _createPO(req['id'].toString()),
                                    icon: const Icon(Icons.add_shopping_cart_rounded, size: 18),
                                    label: const Text('Create Purchase Order'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
