class TransferItem {
  final String id;
  final String medicineId;
  final String medicineName;
  final int requestedQuantity;
  final int allocatedQuantity;
  final int? receivedQuantity;
  final String unitOfMeasure;
  final String? batchNumber;
  final DateTime? expiryDate;

  TransferItem({
    required this.id,
    required this.medicineId,
    required this.medicineName,
    required this.requestedQuantity,
    required this.allocatedQuantity,
    this.receivedQuantity,
    this.unitOfMeasure = 'units',
    this.batchNumber,
    this.expiryDate,
  });

  factory TransferItem.fromJson(Map<String, dynamic> json) {
    return TransferItem(
      id: json['id']?.toString() ?? '',
      medicineId: json['medicineId']?.toString() ?? '',
      medicineName: json['medicineName']?.toString() ?? 'Unknown Medicine',
      requestedQuantity: json['requestedQuantity'] is num
          ? (json['requestedQuantity'] as num).toInt()
          : 0,
      allocatedQuantity: json['allocatedQuantity'] is num
          ? (json['allocatedQuantity'] as num).toInt()
          : 0,
      receivedQuantity: json['receivedQuantity'] is num
          ? (json['receivedQuantity'] as num).toInt()
          : null,
      unitOfMeasure: json['unitOfMeasure']?.toString() ?? 'units',
      batchNumber: json['batchNumber']?.toString(),
      expiryDate: json['expiryDate'] != null
          ? DateTime.tryParse(json['expiryDate'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'medicineId': medicineId,
        'medicineName': medicineName,
        'requestedQuantity': requestedQuantity,
        'allocatedQuantity': allocatedQuantity,
        'receivedQuantity': receivedQuantity,
        'unitOfMeasure': unitOfMeasure,
        'batchNumber': batchNumber,
        'expiryDate': expiryDate?.toIso8601String(),
      };
}

class TransferStatusHistory {
  final String id;
  final String? fromStatus;
  final String toStatus;
  final DateTime changedAt;
  final String? reason;

  TransferStatusHistory({
    required this.id,
    this.fromStatus,
    required this.toStatus,
    required this.changedAt,
    this.reason,
  });

  factory TransferStatusHistory.fromJson(Map<String, dynamic> json) {
    return TransferStatusHistory(
      id: json['id']?.toString() ?? '',
      fromStatus: json['fromStatus']?.toString(),
      toStatus: json['toStatus']?.toString() ?? 'Requested',
      changedAt: json['changedAt'] != null
          ? DateTime.tryParse(json['changedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      reason: json['reason']?.toString(),
    );
  }
}

class Transfer {
  final String id;
  final String transferNumber;
  final String? sourceFacilityId;
  final String? sourceFacilityName;
  final String destinationFacilityId;
  final String destinationFacilityName;
  final String status;
  final String priority;
  final double estimatedDistanceKm;
  final double estimatedDurationMinutes;
  final String? routingProvider;
  final String? rejectionReason;
  final String? notes;
  final String? workflowRunId;
  final DateTime createdAt;
  final DateTime? dispatchedAt;
  final DateTime? receivedAt;
  final double? lastLatitude;
  final double? lastLongitude;
  final DateTime? lastLocationAt;
  final List<TransferItem> items;
  final List<TransferStatusHistory> statusHistory;

  Transfer({
    required this.id,
    required this.transferNumber,
    this.sourceFacilityId,
    this.sourceFacilityName,
    required this.destinationFacilityId,
    required this.destinationFacilityName,
    required this.status,
    required this.priority,
    this.estimatedDistanceKm = 0.0,
    this.estimatedDurationMinutes = 0.0,
    this.routingProvider,
    this.rejectionReason,
    this.notes,
    this.workflowRunId,
    required this.createdAt,
    this.dispatchedAt,
    this.receivedAt,
    this.lastLatitude,
    this.lastLongitude,
    this.lastLocationAt,
    required this.items,
    this.statusHistory = const [],
  });

  String get primaryMedicineName {
    if (items.isNotEmpty) {
      return items.first.medicineName;
    }
    return 'Medicine Shortage';
  }

  int get totalRequestedQuantity {
    if (items.isNotEmpty) {
      return items.fold(0, (sum, item) => sum + item.requestedQuantity);
    }
    return 0;
  }

  int get totalAllocatedQuantity {
    if (items.isNotEmpty) {
      return items.fold(0, (sum, item) => sum + item.allocatedQuantity);
    }
    return 0;
  }

  String? get primaryBatchNumber {
    if (items.isNotEmpty && items.first.batchNumber != null) {
      return items.first.batchNumber;
    }
    return null;
  }

  factory Transfer.fromJson(Map<String, dynamic> json) {
    var rawItems = json['items'];
    List<TransferItem> itemsList = [];
    if (rawItems is List) {
      itemsList = rawItems
          .map((item) => TransferItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } else if (json.containsKey('medicineName')) {
      // Fallback if flat item representation is passed
      itemsList = [
        TransferItem(
          id: json['id']?.toString() ?? '',
          medicineId: json['medicineId']?.toString() ?? '',
          medicineName: json['medicineName']?.toString() ?? 'Medicine',
          requestedQuantity: (json['requestedQuantity'] as num?)?.toInt() ?? 0,
          allocatedQuantity: (json['allocatedQuantity'] as num?)?.toInt() ?? 0,
          batchNumber: json['medicineBatchNumber']?.toString(),
        )
      ];
    }

    var rawHistory = json['statusHistory'] ?? json['statusHistories'];
    List<TransferStatusHistory> historyList = [];
    if (rawHistory is List) {
      historyList = rawHistory
          .map((h) => TransferStatusHistory.fromJson(h as Map<String, dynamic>))
          .toList();
    }

    final distance = json['estimatedDistanceKm'] ?? json['distanceKm'] ?? 0.0;
    final duration = json['estimatedDurationMinutes'] ?? json['durationMinutes'] ?? 0.0;

    return Transfer(
      id: json['id']?.toString() ?? '',
      transferNumber: json['transferNumber']?.toString() ?? '',
      sourceFacilityId: json['sourceFacilityId']?.toString(),
      sourceFacilityName: json['sourceFacilityName']?.toString(),
      destinationFacilityId: json['destinationFacilityId']?.toString() ?? '',
      destinationFacilityName:
          json['destinationFacilityName']?.toString() ?? 'Destination Facility',
      status: json['status']?.toString() ?? 'Draft',
      priority: json['priority']?.toString() ?? 'Routine',
      estimatedDistanceKm: (distance is num) ? distance.toDouble() : 0.0,
      estimatedDurationMinutes: (duration is num) ? duration.toDouble() : 0.0,
      routingProvider: json['routingProvider']?.toString(),
      rejectionReason: json['rejectionReason']?.toString(),
      notes: json['notes']?.toString(),
      workflowRunId: json['workflowRunId']?.toString(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      dispatchedAt: json['dispatchedAt'] != null
          ? DateTime.tryParse(json['dispatchedAt'].toString())
          : null,
      receivedAt: json['receivedAt'] != null
          ? DateTime.tryParse(json['receivedAt'].toString())
          : null,
      lastLatitude: (json['lastLatitude'] as num?)?.toDouble(),
      lastLongitude: (json['lastLongitude'] as num?)?.toDouble(),
      lastLocationAt: json['lastLocationAt'] != null
          ? DateTime.tryParse(json['lastLocationAt'].toString())
          : null,
      items: itemsList,
      statusHistory: historyList,
    );
  }
}

class TransferLocationUpdate {
  final String transferId;
  final double latitude;
  final double longitude;
  final double? speed;
  final double? heading;
  final DateTime timestamp;

  TransferLocationUpdate({
    required this.transferId,
    required this.latitude,
    required this.longitude,
    this.speed,
    this.heading,
    required this.timestamp,
  });

  factory TransferLocationUpdate.fromJson(Map<String, dynamic> json) {
    return TransferLocationUpdate(
      transferId: json['transferId']?.toString() ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      speed: (json['speed'] as num?)?.toDouble(),
      heading: (json['heading'] as num?)?.toDouble(),
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class RouteWaypoint {
  final double latitude;
  final double longitude;
  final String label;

  RouteWaypoint({
    required this.latitude,
    required this.longitude,
    required this.label,
  });

  factory RouteWaypoint.fromJson(Map<String, dynamic> json) {
    return RouteWaypoint(
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      label: json['label']?.toString() ?? '',
    );
  }
}

class RouteDetails {
  final String sourceFacilityId;
  final String sourceFacilityName;
  final double? sourceLatitude;
  final double? sourceLongitude;
  final String destinationFacilityId;
  final String destinationFacilityName;
  final double? destinationLatitude;
  final double? destinationLongitude;
  final double distanceKm;
  final double durationMinutes;
  final String provider;
  final bool isFallback;
  final List<RouteWaypoint> waypoints;

  RouteDetails({
    required this.sourceFacilityId,
    required this.sourceFacilityName,
    this.sourceLatitude,
    this.sourceLongitude,
    required this.destinationFacilityId,
    required this.destinationFacilityName,
    this.destinationLatitude,
    this.destinationLongitude,
    required this.distanceKm,
    required this.durationMinutes,
    required this.provider,
    required this.isFallback,
    required this.waypoints,
  });

  factory RouteDetails.fromJson(Map<String, dynamic> json) {
    var rawWaypoints = json['waypoints'];
    List<RouteWaypoint> waypointsList = [];
    if (rawWaypoints is List) {
      waypointsList = rawWaypoints
          .map((w) => RouteWaypoint.fromJson(w as Map<String, dynamic>))
          .toList();
    }

    final distance = json['distanceKm'] ?? json['estimatedDistanceKm'] ?? 0.0;
    final duration = json['durationMinutes'] ?? json['estimatedDurationMinutes'] ?? 0.0;

    return RouteDetails(
      sourceFacilityId: json['sourceFacilityId']?.toString() ?? '',
      sourceFacilityName: json['sourceFacilityName']?.toString() ?? 'Source Facility',
      sourceLatitude: (json['sourceLatitude'] as num?)?.toDouble(),
      sourceLongitude: (json['sourceLongitude'] as num?)?.toDouble(),
      destinationFacilityId: json['destinationFacilityId']?.toString() ?? '',
      destinationFacilityName:
          json['destinationFacilityName']?.toString() ?? 'Destination Facility',
      destinationLatitude: (json['destinationLatitude'] as num?)?.toDouble(),
      destinationLongitude: (json['destinationLongitude'] as num?)?.toDouble(),
      distanceKm: (distance is num) ? distance.toDouble() : 0.0,
      durationMinutes: (duration is num) ? duration.toDouble() : 0.0,
      provider: json['provider']?.toString() ?? 'HaversineFallback',
      isFallback: json['isFallback'] == true,
      waypoints: waypointsList,
    );
  }
}

class TransferNotificationItem {
  final String id;
  final String transferId;
  final String audience;
  final String? recipientUserId;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;

  TransferNotificationItem({
    required this.id,
    required this.transferId,
    required this.audience,
    this.recipientUserId,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  factory TransferNotificationItem.fromJson(Map<String, dynamic> json) {
    return TransferNotificationItem(
      id: json['id']?.toString() ?? '',
      transferId: json['transferId']?.toString() ?? '',
      audience: json['audience']?.toString() ?? '',
      recipientUserId: json['recipientUserId']?.toString(),
      title: json['title']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      isRead: json['isRead'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  TransferNotificationItem copyWith({
    String? id,
    String? transferId,
    String? audience,
    String? recipientUserId,
    String? title,
    String? message,
    bool? isRead,
    DateTime? createdAt,
  }) {
    return TransferNotificationItem(
      id: id ?? this.id,
      transferId: transferId ?? this.transferId,
      audience: audience ?? this.audience,
      recipientUserId: recipientUserId ?? this.recipientUserId,
      title: title ?? this.title,
      message: message ?? this.message,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

