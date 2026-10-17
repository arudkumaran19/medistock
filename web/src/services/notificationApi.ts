import { apiRequest } from './apiClient';

export interface AppNotification {
  id: string;
  userId: string | null;
  facilityId: string | null;
  role: string | null;
  title: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  linkUrl: string | null;
  shortageAlertId: string | null;
  isRead: boolean;
  createdAtUtc: string;
  readAtUtc: string | null;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface NotificationQuery {
  unreadOnly?: boolean;
  limit?: number;
  facilityId?: string;
}

function qs(query: NotificationQuery): string {
  const params = new URLSearchParams();
  if (query.unreadOnly !== undefined) params.append('unreadOnly', String(query.unreadOnly));
  if (query.limit !== undefined) params.append('limit', String(query.limit));
  if (query.facilityId) params.append('facilityId', query.facilityId);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const notificationApi = {
  async getNotifications(query: NotificationQuery = {}): Promise<AppNotification[]> {
    return apiRequest<AppNotification[]>(`/api/notifications${qs(query)}`);
  },

  async getUnreadCount(facilityId?: string): Promise<UnreadCountResponse> {
    const query = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
    return apiRequest<UnreadCountResponse>(`/api/notifications/unread-count${query}`);
  },

  async markAsRead(id: string): Promise<boolean> {
    return apiRequest<boolean>(`/api/notifications/${id}/read`, {
      method: 'POST',
    });
  },

  async markAllAsRead(): Promise<number> {
    return apiRequest<number>('/api/notifications/read-all', {
      method: 'POST',
    });
  },
};
