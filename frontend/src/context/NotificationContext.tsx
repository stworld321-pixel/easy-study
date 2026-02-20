import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import type { AppNotification } from '../types/notification';
import { API_URL, WS_URL } from '../services/api';

// Re-export for convenience
export type { AppNotification } from '../types/notification';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Fetch notifications from REST API
  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/notifications?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [token]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [token]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const notification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (notification && !notification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, [token, notifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/notifications`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }, [token]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      console.log('[WS] Received:', message.type);

      switch (message.type) {
        case 'NEW_NOTIFICATION':
          // Add new notification to the top
          setNotifications(prev => [message.data, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show browser notification if permitted
          if (Notification.permission === 'granted') {
            new Notification(message.data.title, {
              body: message.data.message,
              icon: '/favicon.ico',
            });
          }
          break;

        case 'NOTIFICATION_READ':
          setNotifications(prev =>
            prev.map(n =>
              n.id === message.data.notification_id ? { ...n, is_read: true } : n
            )
          );
          break;

        case 'ALL_NOTIFICATIONS_READ':
          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
          setUnreadCount(0);
          break;

        case 'UNREAD_COUNT':
          setUnreadCount(message.data.count);
          break;

        case 'CONNECTED':
          console.log('[WS] Connected:', message.data.message);
          break;

        case 'PONG':
          // Heartbeat response
          break;

        default:
          console.log('[WS] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WS] Failed to parse message:', error);
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!token || !user) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${WS_URL}/notifications/ws?token=${token}`;
    console.log('[WS] Connecting...');

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = handleWebSocketMessage;

    ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      setIsConnected(false);

      // Attempt to reconnect if not a clean close
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`[WS] Reconnecting in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connectWebSocket();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    wsRef.current = ws;

    // Setup heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [token, user, handleWebSocketMessage]);

  // Connect WebSocket when user logs in
  useEffect(() => {
    if (user && token) {
      fetchNotifications();
      connectWebSocket();

      // Request browser notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, token, fetchNotifications, connectWebSocket]);

  // Disconnect when user logs out
  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close(1000, 'User logged out');
      }
      setNotifications([]);
      setUnreadCount(0);
      setIsConnected(false);
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
