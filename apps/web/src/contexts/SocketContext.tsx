"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  _id: string;
  type: 'task_assigned' | 'task_updated' | 'mentioned' | 'comment_added' | 'org_member_added' | 'org_role_updated' | 'project_member_added';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  sender: {
    _id: string;
    name: string;
    email: string;
  };
  relatedTask?: {
    _id: string;
    title: string;
  };
  relatedOrganization?: {
    _id: string;
    name: string;
  };
  relatedProject?: {
    _id: string;
    name: string;
  };
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  joinOrganization: (organizationId: string) => void;
  leaveOrganization: (organizationId: string) => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  joinOrganization: () => {},
  leaveOrganization: () => {},
  joinProject: () => {},
  leaveProject: () => {},
});

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load initial notifications and unread count
  const loadInitialNotifications = async () => {
    try {
      // Get token from localStorage or cookies
      const token = localStorage.getItem('token') || document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) return;

      // Load notifications and unread count
      const [notificationsRes, unreadCountRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/notifications`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/notifications/unread-count`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (notificationsRes.ok && unreadCountRes.ok) {
        const notificationsData = await notificationsRes.json();
        const unreadCountData = await unreadCountRes.json();
        
        setNotifications(notificationsData);
        setUnreadCount(unreadCountData.count);
      }
    } catch (error) {
      console.error('Failed to load initial notifications:', error);
    }
  };

  useEffect(() => {
    // Get token from localStorage or cookies
    const token = localStorage.getItem('token') || document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];

    if (!token) {
      console.log('No token found, not connecting to WebSocket');
      return;
    }

    const socketInstance = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
      
      // Load initial notifications when connecting
      loadInitialNotifications();
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Listen for new notifications
    socketInstance.on('newNotification', (data: { notification: Notification; count: number }) => {
      
      setNotifications(prev => {
        const updated = [data.notification, ...prev];
        return updated;
      });
      setUnreadCount(data.count);
      
      // Show browser notification if permission is granted
      if (Notification && Notification.permission === 'granted') {
        new Notification(data.notification.title, {
          body: data.notification.message,
          icon: '/favicon.ico',
          tag: data.notification._id
        });
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        });
      }
    }
  }, []);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const joinOrganization = (organizationId: string) => {
    if (socket && isConnected) {
      socket.emit('join-organization', organizationId);
    }
  };

  const leaveOrganization = (organizationId: string) => {
    if (socket && isConnected) {
      socket.emit('leave-organization', organizationId);
    }
  };

  const joinProject = (projectId: string) => {
    if (socket && isConnected) {
      socket.emit('join-project', projectId);
    }
  };

  const leaveProject = (projectId: string) => {
    if (socket && isConnected) {
      socket.emit('leave-project', projectId);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    joinOrganization,
    leaveOrganization,
    joinProject,
    leaveProject,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
