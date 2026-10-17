import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { TransferDto, TransferLocationUpdate, TransferNotificationDto } from '../../types/redistribution';
import { getStoredToken } from '../../services/apiClient';
import { useAuth } from '../auth/AuthContext';

interface UseTransferSignalROptions {
  transferId?: string;
  isManager?: boolean;
  onStatusChanged?: (transfer: TransferDto) => void;
  onLocationUpdated?: (location: TransferLocationUpdate) => void;
  onNotificationCreated?: (notification: TransferNotificationDto) => void;
  onShortageDismissed?: (shortage: any) => void;
  enabled?: boolean;
}

export function useTransferSignalR({
  transferId,
  isManager = false,
  onStatusChanged,
  onLocationUpdated,
  onNotificationCreated,
  onShortageDismissed,
  enabled = true,
}: UseTransferSignalROptions = {}) {
  let queryClient: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    queryClient = null;
  }
  const { token } = useAuth();
  const currentToken = token || getStoredToken();

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('Disconnected');
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const onStatusChangedRef = useRef(onStatusChanged);
  const onLocationUpdatedRef = useRef(onLocationUpdated);
  const onNotificationCreatedRef = useRef(onNotificationCreated);
  const onShortageDismissedRef = useRef(onShortageDismissed);

  useEffect(() => {
    onStatusChangedRef.current = onStatusChanged;
    onLocationUpdatedRef.current = onLocationUpdated;
    onNotificationCreatedRef.current = onNotificationCreated;
    onShortageDismissedRef.current = onShortageDismissed;
  }, [onStatusChanged, onLocationUpdated, onNotificationCreated, onShortageDismissed]);

  useEffect(() => {
    if (!enabled) return;

    // Resolve backend hub base URL matching apiClient
    const apiBase = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
    const hubUrl = apiBase ? `${apiBase}/hubs/transfers` : '/hubs/transfers';

    let connection: signalR.HubConnection;
    try {
      connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          skipNegotiation: false,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          accessTokenFactory: () => getStoredToken() ?? '',
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.None)
        .build();
    } catch {
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

    connection.on('ShortageAlertDismissed', (shortage: any) => {
      if (queryClient) {
        queryClient.setQueriesData({ queryKey: ['demand', 'shortages'] }, (old: any) => {
          if (!old || !old.items) return old;
          return {
            ...old,
            items: old.items.filter((item: any) => item.id !== shortage.id),
            total: Math.max(0, (old.total ?? old.items.length) - 1),
          };
        });
        queryClient.invalidateQueries({ queryKey: ['demand', 'shortages'] });
      }
      if (onShortageDismissedRef.current) {
        onShortageDismissedRef.current(shortage);
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
      } catch {
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
      } catch {
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
  }, [transferId, isManager, enabled, currentToken]);

  return { isConnected, connectionState };
}
