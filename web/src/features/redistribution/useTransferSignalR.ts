import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { TransferDto, TransferLocationUpdate, TransferNotificationDto } from '../../types/redistribution';

interface UseTransferSignalROptions {
  transferId?: string;
  isManager?: boolean;
  onStatusChanged?: (transfer: TransferDto) => void;
  onLocationUpdated?: (location: TransferLocationUpdate) => void;
  onNotificationCreated?: (notification: TransferNotificationDto) => void;
  enabled?: boolean;
}

export function useTransferSignalR({
  transferId,
  isManager = false,
  onStatusChanged,
  onLocationUpdated,
  onNotificationCreated,
  enabled = true,
}: UseTransferSignalROptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('Disconnected');
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const onStatusChangedRef = useRef(onStatusChanged);
  onStatusChangedRef.current = onStatusChanged;
  const onLocationUpdatedRef = useRef(onLocationUpdated);
  onLocationUpdatedRef.current = onLocationUpdated;
  const onNotificationCreatedRef = useRef(onNotificationCreated);
  onNotificationCreatedRef.current = onNotificationCreated;

  useEffect(() => {
    if (!enabled) return;

    // Resolve an absolute URL to ensure compatibility across JSDOM and browsers
    let hubBase = import.meta.env.VITE_API_BASE_URL || '';
    if (!hubBase && typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      hubBase = window.location.origin;
    }
    if (!hubBase || hubBase.startsWith('/')) {
      hubBase = 'http://localhost:5000';
    }

    const hubUrl = `${hubBase}/hubs/transfers`;

    let connection: signalR.HubConnection;
    try {
      connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          skipNegotiation: false,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.None)
        .build();
    } catch (err) {
      // Offline, test runner, or non-browser environment
      setIsConnected(false);
      setConnectionState('Disconnected');
      return;
    }

    connectionRef.current = connection;

    connection.on('TransferStatusChanged', (transfer: any) => {
      const mappedTransfer: TransferDto = {
        id: transfer.id,
        transferNumber: transfer.transferNumber,
        sourceFacilityId: transfer.sourceFacilityId,
        sourceFacilityName: transfer.sourceFacilityName,
        destinationFacilityId: transfer.destinationFacilityId,
        destinationFacilityName: transfer.destinationFacilityName,
        status: transfer.status,
        priority: transfer.priority,
        distanceKm: transfer.estimatedDistanceKm ?? transfer.distanceKm ?? 0,
        estimatedDurationMinutes: transfer.estimatedDurationMinutes ?? 0,
        routePolyline: transfer.routePolyline,
        routingProvider: transfer.routingProvider,
        lastLatitude: transfer.lastLatitude,
        lastLongitude: transfer.lastLongitude,
        lastLocationAt: transfer.lastLocationAt,
        medicineId: transfer.items?.[0]?.medicineId ?? '',
        medicineName: transfer.items?.[0]?.medicineName ?? '',
        requestedQuantity: transfer.items?.[0]?.requestedQuantity ?? 0,
        allocatedQuantity: transfer.items?.[0]?.allocatedQuantity ?? 0,
        receivedQuantity: transfer.items?.[0]?.receivedQuantity,
        medicineBatchNumber: transfer.items?.[0]?.batchNumber,
        medicineExpiryDate: transfer.items?.[0]?.expiryDate,
        items: transfer.items,
        statusHistories: transfer.statusHistory || transfer.statusHistories,
        workflowRunId: transfer.workflowRunId,
        notes: transfer.notes,
        requestedAt: transfer.createdAt || transfer.requestedAt || '',
        approvedAt: transfer.approvedAt ?? null,
        reservedAt: transfer.reservedAt ?? null,
        dispatchedAt: transfer.dispatchedAt ?? null,
        deliveredAt: transfer.deliveredAt ?? null,
      };

      if (onStatusChangedRef.current) {
        onStatusChangedRef.current(mappedTransfer);
      }
    });

    connection.on('TransferLocationUpdated', (location: any) => {
      const mappedLocation: TransferLocationUpdate = {
        transferId: location.transferId,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        heading: location.heading,
        timestamp: location.timestamp,
      };

      if (onLocationUpdatedRef.current) {
        onLocationUpdatedRef.current(mappedLocation);
      }
    });

    connection.on('NotificationCreated', (notif: any) => {
      const mappedNotif: TransferNotificationDto = {
        id: notif.id,
        transferId: notif.transferId,
        audience: notif.audience,
        recipientUserId: notif.recipientUserId,
        title: notif.title,
        message: notif.message,
        isRead: notif.isRead,
        createdAt: notif.createdAt,
      };

      if (onNotificationCreatedRef.current) {
        onNotificationCreatedRef.current(mappedNotif);
      }
    });

    connection.onreconnecting(() => {
      setIsConnected(false);
      setConnectionState('Reconnecting');
    });

    connection.onreconnected(async () => {
      setIsConnected(true);
      setConnectionState('Connected');

      try {
        if (transferId) {
          await connection.invoke('JoinTransferGroup', transferId);
        }
        if (isManager) {
          await connection.invoke('JoinManagerGroup');
        }
      } catch (err) {
        // Fallback gracefully
      }
    });

    connection.onclose(() => {
      setIsConnected(false);
      setConnectionState('Disconnected');
    });

    const startConnection = async () => {
      try {
        await connection.start();
        setIsConnected(true);
        setConnectionState('Connected');

        if (transferId) {
          await connection.invoke('JoinTransferGroup', transferId);
        }
        if (isManager) {
          await connection.invoke('JoinManagerGroup');
        }
      } catch (err) {
        setIsConnected(false);
        setConnectionState('Failed');
      }
    };

    startConnection();

    return () => {
      if (connectionRef.current) {
        if (transferId && connectionRef.current.state === signalR.HubConnectionState.Connected) {
          connectionRef.current.invoke('LeaveTransferGroup', transferId).catch(() => {});
        }
        if (isManager && connectionRef.current.state === signalR.HubConnectionState.Connected) {
          connectionRef.current.invoke('LeaveManagerGroup').catch(() => {});
        }
        connectionRef.current.stop().catch(() => {});
        connectionRef.current = null;
      }
      setIsConnected(false);
      setConnectionState('Disconnected');
    };
  }, [transferId, isManager, enabled]);

  return { isConnected, connectionState };
}
