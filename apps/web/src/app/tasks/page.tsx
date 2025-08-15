"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import AuthGuard from '../../components/AuthGuard';
import Sidebar from '../../components/Sidebar';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface Workspace {
  _id: string;
  name: string;
  color: string;
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  project: {
    _id: string;
    name: string;
  };
  assignees: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
}

export default function MyTasksPage() {
  const router = useRouter();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [workspaceTasks, setWorkspaceTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');

  useEffect(() => {
    loadInitialData();
    
    // Auto-refresh tasks every 60 seconds
    const interval = setInterval(() => {
      refreshTasks();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTasksByWorkspace();
  }, [currentWorkspace, allTasks]);

  const loadInitialData = async () => {
    try {
      const tasksResponse = await api.get('/tasks/assigned');
      setAllTasks(tasksResponse.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshTasks = async () => {
    setRefreshing(true);
    try {
      const tasksResponse = await api.get('/tasks/assigned');
      setAllTasks(tasksResponse.data);
    } catch (err) {
      console.error('Failed to refresh tasks:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const filterTasksByWorkspace = async () => {
    if (!currentWorkspace) {
      // Show all tasks when no workspace is selected
      setWorkspaceTasks(allTasks);
      return;
    }

    try {
      // Get projects for current workspace
      const projectsResponse = await api.get(`/projects/workspace/${currentWorkspace._id}`);
      const workspaceProjectIds = projectsResponse.data.map((p: any) => p._id);
      
      // Filter tasks that belong to workspace projects
      const filteredTasks = allTasks.filter(task => 
        workspaceProjectIds.includes(task.project._id)
      );
      
      setWorkspaceTasks(filteredTasks);
    } catch (err) {
      console.error('Failed to filter tasks by workspace:', err);
      // Fallback to showing all tasks
      setWorkspaceTasks(allTasks);
    }
  };

  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status });
      setAllTasks(prev => 
        prev.map(task => 
          task._id === taskId ? { ...task, status } : task
        )
      );
      // Refresh the entire task list to ensure consistency
      setTimeout(() => refreshTasks(), 1000);
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700';
      case 'high': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700';
      case 'low': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'in_progress': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'todo': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const filteredTasks = filter === 'all' ? workspaceTasks : workspaceTasks.filter(task => task.status === filter);

  const taskCounts = {
    all: workspaceTasks.length,
    todo: workspaceTasks.filter(t => t.status === 'todo').length,
    in_progress: workspaceTasks.filter(t => t.status === 'in_progress').length,
    done: workspaceTasks.filter(t => t.status === 'done').length
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar currentWorkspace={currentWorkspace || undefined} onWorkspaceChange={setCurrentWorkspace} />
          <div 
            className="flex items-center justify-center min-h-screen transition-all duration-300" 
            style={{ marginLeft: 'var(--sidebar-width, 16rem)' }}
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar currentWorkspace={currentWorkspace || undefined} onWorkspaceChange={setCurrentWorkspace} />
        
        <main 
          className="p-6 transition-all duration-300" 
          style={{ marginLeft: 'var(--sidebar-width, 16rem)' }}
        >
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">My Tasks</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Tasks assigned to you in {currentWorkspace?.name || 'all workspaces'}
                </p>
              </div>
              <button
                onClick={refreshTasks}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className={`text-lg ${refreshing ? 'animate-spin' : ''}`}>
                  🔄
                </span>
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {[
                { key: 'all', label: 'All Tasks', count: taskCounts.all },
                { key: 'todo', label: 'To Do', count: taskCounts.todo },
                { key: 'in_progress', label: 'In Progress', count: taskCounts.in_progress },
                { key: 'done', label: 'Done', count: taskCounts.done }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    filter === tab.key
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No tasks found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {filter === 'all' 
                    ? `You don't have any tasks assigned in ${currentWorkspace?.name || 'this workspace'}.`
                    : `No tasks in ${filter.replace('_', ' ')} status.`
                  }
                </p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <div key={task._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{task.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Project: <span className="font-medium">{task.project.name}</span>
                      </p>
                      
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Created by {task.createdBy.name}</span>
                        {task.dueDate && (
                          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task._id, e.target.value as Task['status'])}
                        className={`px-3 py-1 rounded text-xs font-medium border ${getStatusColor(task.status)} bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600`}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      
                      <button
                        onClick={() => router.push(`/projects/${task.project._id}`)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                      >
                        View Project
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
