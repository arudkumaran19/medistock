import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../models/transfer_models.dart';
import '../services/transfer_api_service.dart';
import '../services/transfer_signalr_service.dart';

class NotificationInboxScreen extends StatefulWidget {
  final TransferApiService? apiService;
  final TransferSignalRService? signalRService;
  final List<TransferNotificationItem>? initialNotifications;

  const NotificationInboxScreen({
    super.key,
    this.apiService,
    this.signalRService,
    this.initialNotifications,
  });

  @override
  State<NotificationInboxScreen> createState() => _NotificationInboxScreenState();
}

class _NotificationInboxScreenState extends State<NotificationInboxScreen> {
  late final TransferApiService _apiService;
  TransferSignalRService? _signalRService;
  StreamSubscription<TransferNotificationItem>? _notifSub;

  List<TransferNotificationItem> _notifications = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? TransferApiService();
    _signalRService = widget.signalRService;

    if (widget.initialNotifications != null) {
      _notifications = List.from(widget.initialNotifications!);
      _isLoading = false;
    } else {
      _loadNotifications();
    }

    _initSignalRListener();
  }

  void _initSignalRListener() {
    if (_signalRService != null) {
      _notifSub = _signalRService!.onNotificationCreated.listen((item) {
        if (mounted) {
          setState(() {
            _notifications.insert(0, item);
          });
        }
      });
    }
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final items = await _apiService.getNotifications(audience: 'FieldOfficer');
      if (mounted) {
        setState(() {
          _notifications = items;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _markAsRead(TransferNotificationItem item) async {
    if (item.isRead) return;

    try {
      await _apiService.markNotificationAsRead(item.id);
      if (mounted) {
        setState(() {
          final idx = _notifications.indexWhere((n) => n.id == item.id);
          if (idx != -1) {
            _notifications[idx] = item.copyWith(isRead: true);
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _markAllAsRead() async {
    try {
      await _apiService.markAllNotificationsAsRead(audience: 'FieldOfficer');
      if (mounted) {
        setState(() {
          _notifications =
              _notifications.map((n) => n.copyWith(isRead: true)).toList();
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _notifSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => !n.isRead).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        actions: [
          if (unreadCount > 0)
            TextButton.icon(
              icon: const Icon(Icons.done_all_rounded, size: 16, color: AppColors.secondary),
              label: const Text(
                'Mark All Read',
                style: TextStyle(
                  color: AppColors.secondary,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
              onPressed: _markAllAsRead,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.secondary),
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
                          onPressed: _loadNotifications,
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _notifications.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceHighlight,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.notifications_none_rounded,
                              size: 48,
                              color: AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'No notifications yet',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Status updates and delivery alerts will appear here',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadNotifications,
                      color: AppColors.secondary,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _notifications.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = _notifications[index];
                          return _buildNotificationCard(item);
                        },
                      ),
                    ),
    );
  }

  Widget _buildNotificationCard(TransferNotificationItem item) {
    IconData icon;
    Color iconColor;

    if (item.title.toLowerCase().contains('way') ||
        item.title.toLowerCase().contains('transit')) {
      icon = Icons.local_shipping_rounded;
      iconColor = AppColors.secondary;
    } else if (item.title.toLowerCase().contains('delivered')) {
      icon = Icons.check_circle_rounded;
      iconColor = AppColors.statusDelivered;
    } else if (item.title.toLowerCase().contains('approved')) {
      icon = Icons.thumb_up_alt_rounded;
      iconColor = AppColors.primary;
    } else if (item.title.toLowerCase().contains('reserved')) {
      icon = Icons.inventory_2_rounded;
      iconColor = AppColors.primary;
    } else if (item.title.toLowerCase().contains('rejected')) {
      icon = Icons.cancel_rounded;
      iconColor = AppColors.statusRejected;
    } else {
      icon = Icons.notifications_active_rounded;
      iconColor = AppColors.secondary;
    }

    return InkWell(
      onTap: () => _markAsRead(item),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: item.isRead
              ? AppColors.surface
              : AppColors.surfaceHighlight.withOpacity(0.8),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: item.isRead
                ? AppColors.border
                : AppColors.secondary.withOpacity(0.5),
            width: item.isRead ? 1 : 1.5,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight:
                                item.isRead ? FontWeight.w600 : FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      if (!item.isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.secondary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.message,
                    style: TextStyle(
                      color: item.isRead
                          ? AppColors.textSecondary
                          : AppColors.textPrimary.withOpacity(0.9),
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _formatTime(item.createdAt),
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}
