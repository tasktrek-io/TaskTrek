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
  onlineUsers: string[];
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  joinOrganization: (organizationId: string) => void;
  leaveOrganization: (organizationId: string) => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  isUserOnline: (userId: string) => boolean;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  notifications: [],
  unreadCount: 0,
  onlineUsers: [],
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  joinOrganization: () => {},
  leaveOrganization: () => {},
  joinProject: () => {},
  leaveProject: () => {},
  isUserOnline: () => false,
  reconnect: () => {},
});

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

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

  // Monitor token changes and manage socket connection
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token') || document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];
      
      return token;
    };

    // Initial token check and connection
    const initialToken = checkToken();
    if (initialToken !== currentToken) {
      setCurrentToken(initialToken || null);
      
      if (initialToken) {
        console.log('Initial token found, connecting to WebSocket');
        connectSocket(initialToken);
      }
    }

    // Set up storage listener for cross-tab token changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        const newToken = checkToken();
        console.log('Cross-tab token change detected:', { from: currentToken, to: newToken });
        
        if (newToken !== currentToken) {
          setCurrentToken(newToken || null);
          
          // Handle logout (token removed)
          if (!newToken && socket) {
            console.log('Token removed (cross-tab), disconnecting socket');
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
            setNotifications([]);
            setUnreadCount(0);
            setOnlineUsers([]);
          }
          // Handle login (new token)
          else if (newToken && !socket) {
            console.log('New token detected (cross-tab), connecting socket');
            connectSocket(newToken);
          }
        }
      }
    };

    // Custom event listener for same-tab logout
    const handleLogout = () => {
      console.log('Logout event detected, disconnecting socket');
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      setCurrentToken(null);
      setNotifications([]);
      setUnreadCount(0);
      setOnlineUsers([]);
    };

    // Custom event listener for same-tab login
    const handleLogin = (event: CustomEvent) => {
      const token = event.detail?.token || checkToken();
      console.log('Login event detected, connecting socket with token');
      if (token && token !== currentToken) {
        setCurrentToken(token);
        // Disconnect existing socket if any
        if (socket) {
          socket.disconnect();
          setSocket(null);
          setIsConnected(false);
        }
        connectSocket(token);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('socket:logout', handleLogout);
    window.addEventListener('socket:login', handleLogin as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('socket:logout', handleLogout);
      window.removeEventListener('socket:login', handleLogin as EventListener);
    };
  }, [currentToken, socket]);

  const connectSocket = (token: string, retryCount = 0) => {
    console.log('SocketContext: Connecting socket with token', token.substring(0, 10) + '...', retryCount > 0 ? `(retry ${retryCount})` : '');

    // Disconnect any existing socket first
    if (socket) {
      console.log('SocketContext: Disconnecting existing socket before creating new one');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }

    const socketInstance = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      // Add timeout settings for AWS
      timeout: 20000, // 20 seconds connection timeout
      forceNew: true,
      reconnection: false // We'll handle reconnection manually
    });

    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket server' + (retryCount > 0 ? ` after ${retryCount} retry attempts` : ''));
      setIsConnected(true);
      
      // Load initial notifications when connecting
      loadInitialNotifications();
    });

    socketInstance.on('disconnect', (reason: string) => {
      console.log('Disconnected from WebSocket server:', reason);
      setIsConnected(false);
      
      // Auto-retry on certain disconnect reasons (but limit retries)
      if ((reason === 'transport error' || reason === 'transport close') && retryCount < 3) {
        console.log(`Auto-retrying connection due to: ${reason} (attempt ${retryCount + 1}/3)`);
        setTimeout(() => {
          const currentToken = localStorage.getItem('token');
          if (currentToken === token) {
            connectSocket(token, retryCount + 1);
          }
        }, 3000 * (retryCount + 1)); // Exponential backoff: 3s, 6s, 9s
      }
    });

    socketInstance.on('connect_error', (error: any) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      
      // Retry on connection error (but limit retries)
      if (retryCount < 3) {
        console.log(`Retrying connection after error (attempt ${retryCount + 1}/3):`, error.message || error);
        setTimeout(() => {
          const currentToken = localStorage.getItem('token');
          if (currentToken === token) {
            connectSocket(token, retryCount + 1);
          }
        }, 5000 * (retryCount + 1)); // Exponential backoff: 5s, 10s, 15s
      } else {
        console.error('Max retry attempts reached. Please check your connection.');
      }
    });

    // Listen for new notifications
    socketInstance.on('newNotification', (data: { notification: Notification; count: number }) => {
      console.log('SocketContext: Received newNotification', data);
      
      setNotifications(prev => {
        // Check if notification already exists to prevent duplicates
        const existingIndex = prev.findIndex(n => n._id === data.notification._id);
        if (existingIndex !== -1) {
          console.log('SocketContext: Notification already exists, skipping duplicate', data.notification._id);
          return prev;
        }
        
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

    // Listen for user status changes (online/offline)
    socketInstance.on('userStatusChange', (data: { userId: string; isOnline: boolean; user: any }) => {
      setOnlineUsers(prev => {
        if (data.isOnline) {
          // Add user to online list if not already there
          return prev.includes(data.userId) ? prev : [...prev, data.userId];
        } else {
          // Remove user from online list
          return prev.filter(id => id !== data.userId);
        }
      });
    });

    // Listen for online users list (when joining rooms)
    socketInstance.on('onlineUsers', (data: { room: string; users: any[] }) => {
      const userIds = data.users.map(user => user._id || user.id);
      setOnlineUsers(prev => {
        // Merge with existing online users, avoiding duplicates
        const merged = [...new Set([...prev, ...userIds])];
        return merged;
      });
    });

    setSocket(socketInstance);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

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
      console.log('SocketContext: Emitting join-organization', organizationId);
      socket.emit('join-organization', organizationId);
    } else {
      console.warn('SocketContext: Cannot join organization - socket not connected', { socket: !!socket, isConnected });
    }
  };

  const leaveOrganization = (organizationId: string) => {
    if (socket && isConnected) {
      console.log('SocketContext: Emitting leave-organization', organizationId);
      socket.emit('leave-organization', organizationId);
    }
  };

  const joinProject = (projectId: string) => {
    if (socket && isConnected) {
      console.log('SocketContext: Emitting join-project', projectId);
      socket.emit('join-project', projectId);
    } else {
      console.warn('SocketContext: Cannot join project - socket not connected', { socket: !!socket, isConnected });
    }
  };

  const leaveProject = (projectId: string) => {
    if (socket && isConnected) {
      console.log('SocketContext: Emitting leave-project', projectId);
      socket.emit('leave-project', projectId);
    }
  };

  const isUserOnline = (userId: string): boolean => {
    return onlineUsers.includes(userId);
  };

  const reconnect = () => {
    const token = localStorage.getItem('token') || document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
    
    if (token && token !== currentToken) {
      console.log('Manual reconnect triggered');
      setCurrentToken(token);
      
      // Disconnect existing socket if any
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      
      // Connect with new token
      connectSocket(token);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    notifications,
    unreadCount,
    onlineUsers,
    addNotification,
    markAsRead,
    markAllAsRead,
    joinOrganization,
    leaveOrganization,
    joinProject,
    leaveProject,
    isUserOnline,
    reconnect,
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
