import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { NotificationBell } from '../features/redistribution/NotificationBell';
import { redistributionApi } from '../services/redistributionApi';
import { TransferNotificationDto } from '../types/redistribution';

let capturedSignalROptions: any = null;

vi.mock('../features/redistribution/useTransferSignalR', () => ({
  useTransferSignalR: (options: any) => {
    capturedSignalROptions = options;
    return { isConnected: true, connectionState: 'Connected' };
  },
}));

vi.mock('../services/redistributionApi', () => ({
  redistributionApi: {
    getNotifications: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
  },
}));

const mockNotifications: TransferNotificationDto[] = [
  {
    id: 'notif-1',
    transferId: 'tr-001',
    audience: 'Manager',
    title: 'New Transfer Requested',
    message: 'Redistribution request TR-2026-0001 submitted for Kandy.',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif-2',
    transferId: 'tr-002',
    audience: 'Manager',
    title: 'Transfer Approved',
    message: 'Transfer TR-2026-0002 was approved.',
    isRead: false,
    createdAt: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'notif-3',
    transferId: 'tr-003',
    audience: 'Manager',
    title: 'Delivery Completed',
    message: 'Transfer TR-2026-0003 has been delivered and received.',
    isRead: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

describe('NotificationBell Component (Manager)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSignalROptions = null;
    vi.mocked(redistributionApi.getNotifications).mockResolvedValue(mockNotifications);
    vi.mocked(redistributionApi.markNotificationAsRead).mockResolvedValue({
      ...mockNotifications[0],
      isRead: true,
    });
    vi.mocked(redistributionApi.markAllNotificationsAsRead).mockResolvedValue(2);
  });

  it('renders bell icon and displays initial unread count badge', async () => {
    render(<NotificationBell />);

    // Initially loads notifications
    await waitFor(() => {
      expect(redistributionApi.getNotifications).toHaveBeenCalledWith({
        audience: 'Manager',
        pageSize: 30,
      });
    });

    // 2 unread out of 3 mock items
    const badge = await screen.findByTestId('notification-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('2');
  });

  it('toggles dropdown and lists notifications with unread indicators', async () => {
    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');
    });

    const bellBtn = screen.getByTestId('notification-bell-btn');
    fireEvent.click(bellBtn);

    const dropdown = await screen.findByTestId('notification-dropdown');
    expect(dropdown).toBeInTheDocument();

    expect(screen.getByText('New Transfer Requested')).toBeInTheDocument();
    expect(screen.getByText('Transfer Approved')).toBeInTheDocument();
    expect(screen.getByText('Delivery Completed')).toBeInTheDocument();
  });

  it('marks a single notification as read and decrements the unread count', async () => {
    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');
    });

    fireEvent.click(screen.getByTestId('notification-bell-btn'));

    const markReadBtn = await screen.findByTestId('mark-read-btn-notif-1');
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(redistributionApi.markNotificationAsRead).toHaveBeenCalledWith('notif-1');
    });

    // Badge count should now be 1
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toHaveTextContent('1');
  });

  it('marks all notifications as read and removes badge', async () => {
    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');
    });

    fireEvent.click(screen.getByTestId('notification-bell-btn'));

    const markAllBtn = await screen.findByTestId('mark-all-read-btn');
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(redistributionApi.markAllNotificationsAsRead).toHaveBeenCalledWith('Manager');
    });

    // Badge should be gone
    await waitFor(() => {
      expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    });
  });

  it('updates bell unread count and appends notification live when SignalR event arrives', async () => {
    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');
    });

    // Simulate SignalR event
    expect(capturedSignalROptions).not.toBeNull();
    const newNotif: TransferNotificationDto = {
      id: 'notif-live-999',
      transferId: 'tr-099',
      audience: 'Manager',
      title: 'Stock Reserved at Depot',
      message: 'Items for TR-2026-0099 reserved at Colombo depot.',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    act(() => {
      capturedSignalROptions.onNotificationCreated(newNotif);
    });

    // Unread count should increment from 2 to 3
    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('3');
    });

    // Open dropdown and ensure the live notification appears
    fireEvent.click(screen.getByTestId('notification-bell-btn'));
    expect(await screen.findByText('Stock Reserved at Depot')).toBeInTheDocument();
  });
});
