"use client";
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface ActivityItem {
  _id: string;
  action: string;
  details: string;
  performedBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
}

interface TaskActivityProps {
  taskId: string;
}

export default function TaskActivity({ taskId }: TaskActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadActivities = async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await api.get(`/tasks/${taskId}/activities`, {
        params: { page: pageNum, limit: 10 }
      });
      
      if (pageNum === 1) {
        setActivities(response.data.activities);
      } else {
        setActivities(prev => [...prev, ...response.data.activities]);
      }
      
      setHasMore(pageNum < response.data.totalPages);
    } catch (err) {
      console.error('Failed to load task activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      loadActivities(1);
    }
  }, [taskId]);

  const loadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadActivities(nextPage);
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'created':
        return '🎯';
      case 'status_changed':
        return '📋';
      case 'priority_changed':
        return '⚡';
      case 'assigned':
        return '👤';
      case 'unassigned':
        return '👤';
      case 'due_date_changed':
        return '📅';
      case 'title_changed':
        return '✏️';
      case 'description_changed':
        return '📝';
      case 'comment_added':
        return '💬';
      case 'comment_reaction_added':
        return '👍';
      case 'comment_reaction_removed':
        return '👎';
      default:
        return '📌';
    }
  };

  const getActivityColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'text-green-600 dark:text-green-400';
      case 'status_changed':
        return 'text-blue-600 dark:text-blue-400';
      case 'priority_changed':
        return 'text-orange-600 dark:text-orange-400';
      case 'assigned':
      case 'unassigned':
        return 'text-purple-600 dark:text-purple-400';
      case 'due_date_changed':
        return 'text-red-600 dark:text-red-400';
      case 'title_changed':
      case 'description_changed':
        return 'text-gray-600 dark:text-gray-400';
      case 'comment_added':
        return 'text-green-600 dark:text-green-400';
      case 'comment_reaction_added':
      case 'comment_reaction_removed':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  if (loading && activities.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">Activity</h3>
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-gray-100">Activity</h3>
      
      <div className="space-y-3">
        {activities.map(activity => (
          <div key={activity._id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-lg">{getActivityIcon(activity.action)}</div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {activity.performedBy.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTimestamp(activity.createdAt)}
                </span>
              </div>
              
              <p className={`text-sm ${getActivityColor(activity.action)}`}>
                {activity.details}
              </p>
              
              {/* Show field changes for debugging/detailed view */}
              {activity.field && (activity.oldValue !== undefined || activity.newValue !== undefined) && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {activity.oldValue && (
                    <span>From: <em>{String(activity.oldValue)}</em></span>
                  )}
                  {activity.oldValue && activity.newValue && <span> → </span>}
                  {activity.newValue && (
                    <span>To: <em>{String(activity.newValue)}</em></span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {activities.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No activity yet</p>
        )}
        
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full text-center py-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load more activity'}
          </button>
        )}
      </div>
    </div>
  );
}
