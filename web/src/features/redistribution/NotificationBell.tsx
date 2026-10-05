import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Clock, ExternalLink } from 'lucide-react';
import { TransferNotificationDto } from '../../types/redistribution';
import { redistributionApi } from '../../services/redistributionApi';
import { useTransferSignalR } from './useTransferSignalR';

interface NotificationBellProps {
  onNotificationClick?: (notification: TransferNotificationDto) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNotificationClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<TransferNotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load initial notifications for managers
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const items = await redistributionApi.getNotifications({ audience: 'Manager', pageSize: 30 });
      setNotifications(items);
    } catch (err) {
      console.error('Failed to fetch manager notifications', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Real-time SignalR push notifications for manager group
  useTransferSignalR({
    isManager: true,
    onNotificationCreated: (notif) => {
      // If notification is for managers (or audience matches)
      if (!notif.audience || notif.audience.toLowerCase() === 'manager') {
        setNotifications((prev) => {
          // Avoid duplicates
          if (prev.some((n) => n.id === notif.id)) return prev;
          return [notif, ...prev];
        });
      }
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await redistributionApi.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await redistributionApi.markAllNotificationsAsRead('Manager');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDay = Math.floor(diffHour / 24);
      return `${diffDay}d ago`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Button */}
      <button
        type="button"
        data-testid="notification-bell-btn"
        aria-label="Open notifications"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: isOpen ? 'rgba(15, 118, 110, 0.12)' : 'var(--bg-tertiary, #f1f5f9)',
          border: isOpen ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOpen ? 'var(--color-primary, #0f766e)' : '#475569',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all var(--transition-fast)',
          padding: 0,
        }}
      >
        <Bell size={18} />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 700,
              minWidth: '18px',
              height: '18px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
              border: '2px solid var(--bg-secondary)',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div
          data-testid="notification-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '380px',
            maxHeight: '480px',
            backgroundColor: 'var(--bg-secondary)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--color-primary)',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 600,
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                data-testid="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* List items */}
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {isLoading && notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <Bell size={28} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '8px' }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  No notifications yet
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Real-time updates will appear here automatically.
                </div>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  data-testid={`notification-item-${item.id}`}
                  onClick={() => onNotificationClick?.(item)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: item.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.05)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    cursor: onNotificationClick ? 'pointer' : 'default',
                    transition: 'background-color var(--transition-fast)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = item.isRead
                      ? 'rgba(255, 255, 255, 0.02)'
                      : 'rgba(16, 185, 129, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = item.isRead
                      ? 'transparent'
                      : 'rgba(16, 185, 129, 0.05)';
                  }}
                >
                  {/* Unread indicator dot */}
                  <div style={{ paddingTop: '4px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: item.isRead ? 'transparent' : 'var(--color-primary)',
                        display: 'block',
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: item.isRead ? 500 : 700,
                        color: item.isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                        marginBottom: '2px',
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.4,
                        marginBottom: '4px',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.message}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Clock size={11} />
                      <span>{formatTimeAgo(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {!item.isRead && (
                    <button
                      type="button"
                      data-testid={`mark-read-btn-${item.id}`}
                      aria-label="Mark as read"
                      onClick={(e) => handleMarkAsRead(item.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      title="Mark as read"
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
