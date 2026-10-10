import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_constants.dart';
import '../models/transfer_models.dart';
import '../services/transfer_api_service.dart';
import '../services/transfer_signalr_service.dart';
import 'receive_transfer_screen.dart';
import 'transfer_tracking_screen.dart';

class TransferDetailsScreen extends StatefulWidget {
  final String transferId;
  final TransferApiService? apiService;
  final TransferSignalRService? signalRService;
  final Transfer? initialTransfer;
  final bool enablePolling;

  const TransferDetailsScreen({
    super.key,
    required this.transferId,
    this.apiService,
    this.signalRService,
    this.initialTransfer,
    this.enablePolling = true,
  });

  @override
  State<TransferDetailsScreen> createState() => _TransferDetailsScreenState();
}

class _TransferDetailsScreenState extends State<TransferDetailsScreen> {
  late final TransferApiService _apiService;
  TransferSignalRService? _signalRService;
  StreamSubscription<Transfer>? _signalRSubscription;
  StreamSubscription<bool>? _signalRStateSubscription;
  bool _isSignalRConnected = false;
  Transfer? _transfer;
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _pollingTimer;

  static const List<String> _pipelineSteps = [
    'Draft',
    'Requested',
    'Proposed',
    'Approved',
    'Reserved',
    'InTransit',
    'Delivered',
  ];

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? TransferApiService();

    if (widget.initialTransfer != null) {
      _transfer = widget.initialTransfer;
      _isLoading = false;
    } else {
      _loadTransfer();
    }

    _initSignalR();

    if (widget.enablePolling) {
      _startPolling();
    }
  }

  void _initSignalR() {
    _signalRService = widget.signalRService ?? TransferSignalRService();
    _signalRSubscription = _signalRService!.onTransferStatusChanged.listen((updated) {
      if (mounted && updated.id == widget.transferId) {
        setState(() {
          _transfer = updated;
        });
      }
    });
    _signalRStateSubscription = _signalRService!.onConnectionStateChanged.listen((connected) {
      if (mounted) {
        setState(() {
          _isSignalRConnected = connected;
        });
      }
    });
    _signalRService!.initAndConnect(transferId: widget.transferId);
  }

  void _startPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      // Keep polling only as a fallback when the socket is disconnected
      if (mounted && !_isSignalRConnected) {
        _loadTransfer(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _signalRSubscription?.cancel();
    _signalRStateSubscription?.cancel();
    _signalRService?.disconnect();
    super.dispose();
  }

  Future<void> _loadTransfer({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final data = await _apiService.getTransferById(widget.transferId);
      if (mounted) {
        setState(() {
          _transfer = data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          if (!silent) {
            _errorMessage = e.toString();
          }
        });
      }
    }
  }

  Widget _buildStatusBadge(String status) {
    final color = AppColors.getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildPriorityBadge(String priority) {
    final color = AppColors.getPriorityColor(priority);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        priority,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildPipelineTimeline(String currentStatus) {
    final currentIndex = _pipelineSteps.indexWhere(
      (s) => s.toLowerCase() == currentStatus.toLowerCase(),
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Transfer Lifecycle Pipeline',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: List.generate(_pipelineSteps.length, (index) {
              final step = _pipelineSteps[index];
              final isDone = currentIndex >= index;
              final isCurrent = currentIndex == index;

              return Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: isDone
                            ? AppColors.primary
                            : AppColors.surfaceHighlight,
                        shape: BoxShape.circle,
                        border: isCurrent
                            ? Border.all(color: Colors.white, width: 2)
                            : null,
                      ),
                      child: Center(
                        child: isDone
                            ? const Icon(Icons.check, size: 16, color: Colors.white)
                            : Text(
                                '${index + 1}',
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      step,
                      style: TextStyle(
                        color: isCurrent
                            ? AppColors.textPrimary
                            : AppColors.textMuted,
                        fontSize: 10,
                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          _transfer != null ? 'Transfer ${_transfer!.transferNumber}' : 'Transfer Details',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadTransfer,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppColors.statusRejected),
                        const SizedBox(height: 12),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadTransfer,
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _transfer == null
                  ? const Center(child: Text('Transfer not found'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Header Status Card
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        _buildStatusBadge(_transfer!.status),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: _isSignalRConnected ? AppColors.primary.withOpacity(0.15) : Colors.amber.withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: _isSignalRConnected ? AppColors.primary.withOpacity(0.4) : Colors.amber.withOpacity(0.4)),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Container(
                                                width: 6,
                                                height: 6,
                                                decoration: BoxDecoration(
                                                  color: _isSignalRConnected ? AppColors.primary : Colors.amber,
                                                  shape: BoxShape.circle,
                                                ),
                                              ),
                                              const SizedBox(width: 4),
                                              Text(
                                                _isSignalRConnected ? 'LIVE' : 'POLLING',
                                                style: TextStyle(
                                                  color: _isSignalRConnected ? AppColors.primary : Colors.amber,
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                    _buildPriorityBadge(_transfer!.priority),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  _transfer!.transferNumber,
                                  style: const TextStyle(
                                    color: AppColors.secondary,
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Declared on ${DateFormat.yMMMd().add_jm().format(_transfer!.createdAt)}',
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 16),

                          // Pipeline Lifecycle Timeline
                          _buildPipelinePipelineOrFallback(_transfer!.status),

                          const SizedBox(height: 16),

                          // Line Items Section
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.medication_rounded, color: AppColors.primary, size: 20),
                                    SizedBox(width: 8),
                                    Text(
                                      'Medicines & Line Items',
                                      style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                ..._transfer!.items.map((item) {
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: AppColors.background.withOpacity(0.5),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                item.medicineName,
                                                style: const TextStyle(
                                                  color: AppColors.textPrimary,
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 14,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                'Batch: ${item.batchNumber ?? "Pending Allocation"}',
                                                style: const TextStyle(
                                                  color: AppColors.textSecondary,
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              '${item.allocatedQuantity > 0 ? item.allocatedQuantity : item.requestedQuantity} ${item.unitOfMeasure}',
                                              style: const TextStyle(
                                                color: AppColors.primary,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 15,
                                              ),
                                            ),
                                            Text(
                                              item.allocatedQuantity > 0 ? 'Allocated' : 'Requested',
                                              style: const TextStyle(
                                                color: AppColors.textMuted,
                                                fontSize: 11,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                              ],
                            ),
                          ),

                          const SizedBox(height: 16),

                          // Hospital Facilities Section
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.local_hospital_rounded, color: AppColors.secondary, size: 20),
                                    SizedBox(width: 8),
                                    Text(
                                      'Hospital Facilities & Route',
                                      style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                _buildFacilityRow(
                                  icon: Icons.storefront_rounded,
                                  title: 'Supplying Facility (Sender)',
                                  name: _transfer!.sourceFacilityName ?? 'Pending candidate assignment',
                                ),
                                const Divider(color: AppColors.border, height: 20),
                                _buildFacilityRow(
                                  icon: Icons.location_on_rounded,
                                  title: 'Destination Facility (Recipient)',
                                  name: _transfer!.destinationFacilityName,
                                ),
                                if (_transfer!.estimatedDistanceKm > 0) ...[
                                  const Divider(color: AppColors.border, height: 20),
                                  Row(
                                    children: [
                                      const Icon(Icons.route_rounded, color: AppColors.textSecondary, size: 18),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Road Distance: ${_transfer!.estimatedDistanceKm.toStringAsFixed(1)} km (~${_transfer!.estimatedDurationMinutes.toStringAsFixed(0)} mins)',
                                        style: const TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),

                          const SizedBox(height: 24),

                          if (_transfer!.status.toLowerCase() == 'reserved' ||
                              _transfer!.status.toLowerCase() == 'approved') ...[
                            ElevatedButton.icon(
                              onPressed: () async {
                                // TODO: enforce roles after auth merge (pickup: field officer)
                                await _apiService.dispatchTransfer(_transfer!.id, notes: 'Consignment confirmed pickup by field officer.');
                                _loadTransfer();
                              },
                              icon: const Icon(Icons.local_shipping_rounded, size: 18),
                              label: const Text('Confirm Pickup'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                            ),
                            const SizedBox(height: 10),
                          ],

                          if (_transfer!.status.toLowerCase() == 'intransit') ...[
                            ElevatedButton.icon(
                              onPressed: () async {
                                // TODO: enforce roles after auth merge (delivery: field officer)
                                final received = await Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ReceiveTransferScreen(
                                      transfer: _transfer!,
                                      apiService: _apiService,
                                    ),
                                  ),
                                );
                                if (received == true) _loadTransfer();
                              },
                              icon: const Icon(Icons.inventory_rounded, size: 18),
                              label: const Text('Confirm Delivery'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                            ),
                            const SizedBox(height: 10),
                          ],

                          if (_transfer!.status.toLowerCase() == 'intransit' ||
                              _transfer!.status.toLowerCase() == 'reserved' ||
                              _transfer!.status.toLowerCase() == 'approved')
                            OutlinedButton.icon(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => TransferTrackingScreen(
                                      transfer: _transfer!,
                                      apiService: _apiService,
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.navigation_rounded, size: 18),
                              label: const Text('Track Road Transit & Waypoints'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.secondary,
                                side: const BorderSide(color: AppColors.secondary),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                            ),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildPipelinePipelineOrFallback(String status) {
    return _buildPipelineTimeline(status);
  }

  Widget _buildFacilityRow({
    required IconData icon,
    required String title,
    required String name,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AppColors.textSecondary, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
              ),
              const SizedBox(height: 2),
              Text(
                name,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
