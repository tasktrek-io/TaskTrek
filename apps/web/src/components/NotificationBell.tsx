"use client";

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Icons } from '../lib/icons';
import { useSocket } from '../contexts/SocketContext';

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

interface NotificationProps {
  onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationBell({ onNotificationClick }: NotificationProps) {
  const { 
    notifications: socketNotifications, 
    unreadCount: socketUnreadCount, 
    isConnected,
    markAsRead: socketMarkAsRead,
    markAllAsRead: socketMarkAllAsRead 
  } = useSocket();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNewNotificationPulse, setShowNewNotificationPulse] = useState(false);
  const [newNotificationIds, setNewNotificationIds] = useState<Set<string>>(new Set());

  // Track previous unread count for pulse animation
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);

  // Update notifications when socket data changes
  useEffect(() => {

    if (isConnected) {
      // Always update notifications from socket, regardless of dropdown state
      setNotifications(socketNotifications);
      setUnreadCount(socketUnreadCount);
    }
  }, [isConnected, socketNotifications, socketUnreadCount, showDropdown]);

  // Handle pulse animation when unread count changes
  useEffect(() => {
    if (isConnected && socketUnreadCount > prevUnreadCount && prevUnreadCount >= 0 && socketUnreadCount > 0) {
      setShowNewNotificationPulse(true);
      setTimeout(() => setShowNewNotificationPulse(false), 1000);
    }
    setPrevUnreadCount(socketUnreadCount);
  }, [socketUnreadCount, isConnected]);

  // Fallback polling when disconnected
  // useEffect(() => {
  //   if (!isConnected) {
  //     loadUnreadCount();
  //     const interval = setInterval(loadUnreadCount, 30000);
  //     return () => clearInterval(interval);
  //   }
  // }, [isConnected]);

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  const loadNotifications = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await api.get('/notifications');
      
      if (isConnected) {
        // When connected via socket, only load from API if we don't have notifications yet
        // This prevents overriding real-time updates
        if (socketNotifications.length === 0) {
          setNotifications(response.data);
        }
        // Otherwise, let the socket handle the notifications
      } else {
        // When disconnected, use API response
        setNotifications(response.data);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      
      if (isConnected) {
        // Use socket context method when connected
        socketMarkAsRead(notificationId);
      } else {
        // Fallback: update local state when disconnected
        setNotifications(prev => 
          prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      
      if (isConnected) {
        // Use socket context method when connected
        socketMarkAllAsRead();
      } else {
        // Fallback: update local state when disconnected
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Remove from new notifications when clicked
    setNewNotificationIds(prev => {
      const updated = new Set(prev);
      updated.delete(notification._id);
      return updated;
    });
    
    if (!notification.read) {
      markAsRead(notification._id);
    }
    onNotificationClick?.(notification);
    setShowDropdown(false);
  };

  const toggleDropdown = () => {
    if (!showDropdown) {
      // Only load notifications from API if socket is not connected
      // When socket is connected, use real-time data exclusively
      if (!isConnected) {
        loadNotifications();
      }
    }
    setShowDropdown(!showDropdown);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned': return <Icons.Clipboard className="w-5 h-5" />;
      case 'task_updated': return <Icons.RefreshCw className="w-5 h-5" />;
      case 'mentioned': return <Icons.AtSign className="w-5 h-5" />;
      case 'comment_added': return <Icons.MessageSquare className="w-5 h-5" />;
      case 'org_member_added': return <Icons.Building2 className="w-5 h-5" />;
      case 'org_role_updated': return <Icons.User className="w-5 h-5" />;
      case 'project_member_added': return <Icons.Folder className="w-5 h-5" />;
      default: return <Icons.Bell className="w-5 h-5" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 focus:outline-none"
        title={isConnected ? 'Real-time notifications enabled' : 'Using fallback notifications'}
      >
        <Icons.Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* New notification pulse animation */}
        {showNewNotificationPulse && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full animate-ping opacity-75"></span>
        )}
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute mt-2 w-72 sm:w-80 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-96 overflow-hidden max-w-[95vw] sm:max-w-none 
                          sm:min-w-[320px] transform -translate-x-2 sm:translate-x-0">
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 sticky top-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0 whitespace-nowrap"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-3 sm:p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-3 sm:p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification, index) => (
                  <div
                    key={`${notification._id}-${index}`}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    } ${
                      newNotificationIds.has(notification._id) ? 'ring-2 ring-blue-400 bg-blue-100 dark:bg-blue-800' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-base sm:text-lg flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-start justify-between gap-1 sm:gap-2 mb-1">
                          <h4 className="font-medium text-xs sm:text-sm text-gray-900 dark:text-gray-100 leading-tight">
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            {!notification.read && (
                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full"></div>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {getTimeAgo(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 leading-tight" 
                           style={{ 
                             display: '-webkit-box',
                             WebkitLineClamp: 2,
                             WebkitBoxOrient: 'vertical' as const,
                             overflow: 'hidden'
                           }}>
                          {notification.message}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block leading-tight" 
                              style={{ 
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical' as const,
                                overflow: 'hidden'
                              }}>
                          From: {notification?.sender?.name || 'Deleted User'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
