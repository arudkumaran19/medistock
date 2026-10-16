import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from './NotificationBell';
import { renderWithProviders } from '@/features/demand/testUtils';
import type { AppNotification } from '@/services/notificationApi';

vi.mock('@/services/notificationApi', () => ({
  notificationApi: {
    getUnreadCount: vi.fn(),
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      userId: 'test-user-id',
      email: 'manager@medistock.com',
      roles: ['FacilityManager'],
    },
  }),
}));

const { notificationApi } = await import('@/services/notificationApi');
const mockNotificationApi = vi.mocked(notificationApi);

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without badge when unreadCount is 0', async () => {
    mockNotificationApi.getUnreadCount.mockResolvedValue({ unreadCount: 0 });

    renderWithProviders(<NotificationBell />);

    expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
  });

  it('renders unread badge when unreadCount is greater than 0', async () => {
    mockNotificationApi.getUnreadCount.mockResolvedValue({ unreadCount: 5 });

    renderWithProviders(<NotificationBell />);

    const badge = await screen.findByTestId('notification-unread-badge');
    expect(badge).toHaveTextContent('5');
  });

  it('opens notification popover on bell click and loads notifications', async () => {
    const user = userEvent.setup();
    mockNotificationApi.getUnreadCount.mockResolvedValue({ unreadCount: 1 });
    const mockNotifs: AppNotification[] = [
      {
        id: 'notif-1',
        userId: 'test-user-id',
        facilityId: 'b1000000-0000-0000-0000-000000000002',
        role: 'FacilityManager',
        title: 'Critical Stockout Alert',
        message: 'Amoxicillin 500mg has 2 days of cover remaining.',
        severity: 'HIGH',
        linkUrl: '/demand/shortages/alert-1',
        shortageAlertId: 'alert-1',
        isRead: false,
        createdAtUtc: new Date().toISOString(),
        readAtUtc: null,
      },
    ];
    mockNotificationApi.getNotifications.mockResolvedValue(mockNotifs);

    renderWithProviders(<NotificationBell />);
    await screen.findByTestId('notification-unread-badge');

    await user.click(screen.getByRole('button', { name: /Notifications/i }));

    expect(await screen.findByTestId('notification-popover')).toBeInTheDocument();
    expect(await screen.findByText('Critical Stockout Alert')).toBeInTheDocument();
    expect(
      screen.getByText('Amoxicillin 500mg has 2 days of cover remaining.'),
    ).toBeInTheDocument();
  });

  it('triggers markAllAsRead when Mark all read is clicked', async () => {
    const user = userEvent.setup();
    mockNotificationApi.getUnreadCount.mockResolvedValue({ unreadCount: 2 });
    mockNotificationApi.getNotifications.mockResolvedValue([]);
    mockNotificationApi.markAllAsRead.mockResolvedValue(2);

    renderWithProviders(<NotificationBell />);
    await screen.findByTestId('notification-unread-badge');

    await user.click(screen.getByRole('button', { name: /Notifications/i }));
    const markAllBtn = await screen.findByRole('button', { name: /Mark all read/i });

    await user.click(markAllBtn);

    await waitFor(() => {
      expect(mockNotificationApi.markAllAsRead).toHaveBeenCalledTimes(1);
    });
  });

  it('displays unread dot indicator for unread notifications and marks single as read', async () => {
    const user = userEvent.setup();
    mockNotificationApi.getUnreadCount.mockResolvedValue({ unreadCount: 1 });
    const mockNotifs: AppNotification[] = [
      {
        id: 'notif-unread',
        userId: 'test-user-id',
        facilityId: 'b1000000-0000-0000-0000-000000000002',
        role: 'FacilityManager',
        title: 'Pending Transfer Approval',
        message: 'Amoxicillin transfer request #102 is awaiting review.',
        severity: 'MEDIUM',
        linkUrl: '/redistribution/transfers',
        shortageAlertId: null,
        isRead: false,
        createdAtUtc: new Date().toISOString(),
        readAtUtc: null,
      },
    ];
    mockNotificationApi.getNotifications.mockResolvedValue(mockNotifs);
    mockNotificationApi.markAsRead.mockResolvedValue(true);

    renderWithProviders(<NotificationBell />);
    await user.click(screen.getByRole('button', { name: /Notifications/i }));

    const dot = await screen.findByTestId('notification-unread-dot');
    expect(dot).toBeInTheDocument();

    const markBtn = screen.getByRole('button', { name: /Mark as read/i });
    await user.click(markBtn);

    await waitFor(() => {
      expect(mockNotificationApi.markAsRead).toHaveBeenCalledWith('notif-unread');
    });
  });
});
