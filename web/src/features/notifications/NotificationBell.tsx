import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, QueryClientContext } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { notificationApi, type AppNotification } from '@/services/notificationApi';
import { useAuth } from '@/features/auth/AuthContext';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

interface NotificationBellProps {
  theme?: 'dark' | 'light';
}

export function NotificationBell(props: NotificationBellProps) {
  const queryClient = useContext(QueryClientContext);
  if (!queryClient) {
    return (
      <div
        style={{
          color: props.theme === 'dark' ? '#94a3b8' : '#64748b',
          padding: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bell size={18} strokeWidth={2} />
      </div>
    );
  }
  return <NotificationBellInner {...props} />;
}

function NotificationBellInner({ theme = 'dark' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Poll unread count every 15 seconds
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: 15000,
    staleTime: 10000,
    enabled: Boolean(user),
  });

  const unreadCount = countData?.unreadCount ?? 0;

  // Fetch recent notifications when dropdown is open or stale
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationApi.getNotifications({ limit: 25 }),
    enabled: isOpen && Boolean(user),
    staleTime: 10000,
  });

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await markReadMutation.mutateAsync(notif.id);
    }
    setIsOpen(false);
    if (notif.linkUrl) {
      navigate(notif.linkUrl);
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'HIGH':
        return {
          icon: <AlertCircle size={15} color="#ef4444" />,
          badgeBg: 'rgba(239, 68, 68, 0.12)',
          badgeColor: '#dc2626',
          borderLeft: '3px solid #ef4444',
        };
      case 'MEDIUM':
        return {
          icon: <AlertTriangle size={15} color="#f59e0b" />,
          badgeBg: 'rgba(245, 158, 11, 0.12)',
          badgeColor: '#d97706',
          borderLeft: '3px solid #f59e0b',
        };
      case 'LOW':
      case 'INFO':
      default:
        return {
          icon: <Info size={15} color="#0d9488" />,
          badgeBg: 'rgba(13, 148, 136, 0.12)',
          badgeColor: '#0f766e',
          borderLeft: '3px solid #0d9488',
        };
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: 'relative',
          background: isOpen
            ? theme === 'dark'
              ? 'rgba(255, 255, 255, 0.15)'
              : '#e2e8f0'
            : 'transparent',
          border: 'none',
          borderRadius: 8,
          padding: 7,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme === 'dark' ? '#94a3b8' : '#475569',
          transition: 'all 150ms ease-in-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = theme === 'dark' ? '#f8fafc' : '#0f172a';
          e.currentTarget.style.background =
            theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#475569';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.6875rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              boxShadow: '0 0 0 2px ' + (theme === 'dark' ? '#0f172a' : '#ffffff'),
              animation: 'pulseBadge 2s infinite',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="notification-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
            background: '#ffffff',
            borderRadius: 12,
            boxShadow:
              '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'dropdownIn 150ms ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fafafa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#dc2626',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0d9488',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 6px',
                  borderRadius: 4,
                }}
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div
            style={{
              maxHeight: 380,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            {isLoading ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.8125rem',
                }}
              >
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Bell size={28} strokeWidth={1.5} color="#cbd5e1" />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                  No notifications yet
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 220 }}>
                  Shortage alerts and supply chain updates will appear here automatically.
                </span>
              </div>
            ) : (
              notifications.map((notif) => {
                const style = getSeverityStyle(notif.severity);
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      borderLeft: notif.isRead ? '3px solid transparent' : style.borderLeft,
                      background: notif.isRead ? '#ffffff' : '#f0fdfa',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      transition: 'background 120ms ease-in-out',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = notif.isRead ? '#f8fafc' : '#e6fffa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = notif.isRead ? '#ffffff' : '#f0fdfa';
                    }}
                  >
                    <div style={{ paddingTop: 2, flexShrink: 0 }}>{style.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          marginBottom: 2,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          {!notif.isRead && (
                            <span
                              data-testid="notification-unread-dot"
                              aria-label="Unread notification"
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                backgroundColor: '#0d9488',
                                display: 'inline-block',
                                flexShrink: 0,
                                boxShadow: '0 0 0 2px rgba(13, 148, 136, 0.25)',
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontWeight: notif.isRead ? 500 : 700,
                              fontSize: '0.8125rem',
                              color: notif.isRead ? '#475569' : '#0f172a',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {notif.title}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: '#94a3b8',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatRelativeTime(notif.createdAtUtc)}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          margin: 0,
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {notif.message}
                      </p>
                    </div>

                    {!notif.isRead && (
                      <button
                        type="button"
                        aria-label="Mark as read"
                        title="Mark as read"
                        onClick={(e) => {
                          e.stopPropagation();
                          markReadMutation.mutate(notif.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#0d9488';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#94a3b8';
                        }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseBadge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default NotificationBell;
