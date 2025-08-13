"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import AuthGuard from '../../components/AuthGuard';
import Sidebar from '../../components/Sidebar';

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
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [workspaceTasks, setWorkspaceTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    filterTasksByWorkspace();
  }, [currentWorkspace, allTasks]);

  const loadInitialData = async () => {
    try {
      const [tasksResponse, workspacesResponse] = await Promise.all([
        api.get('/tasks/assigned'),
        api.get('/workspaces')
      ]);
      
      setAllTasks(tasksResponse.data);
      
      // Set first workspace as default
      if (workspacesResponse.data.length > 0) {
        setCurrentWorkspace(workspacesResponse.data[0]);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterTasksByWorkspace = async () => {
    if (!currentWorkspace) {
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
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'todo': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar currentWorkspace={currentWorkspace || undefined} onWorkspaceChange={setCurrentWorkspace} />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar currentWorkspace={currentWorkspace || undefined} onWorkspaceChange={setCurrentWorkspace} />
        
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Tasks</h1>
            <p className="text-gray-600">
              Tasks assigned to you in {currentWorkspace?.name || 'all workspaces'}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-lg border mb-6">
            <div className="flex border-b">
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
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
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
              <div className="bg-white rounded-lg border p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
                <p className="text-gray-600">
                  {filter === 'all' 
                    ? `You don't have any tasks assigned in ${currentWorkspace?.name || 'this workspace'}.`
                    : `No tasks in ${filter.replace('_', ' ')} status.`
                  }
                </p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <div key={task._id} className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{task.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        Project: <span className="font-medium">{task.project.name}</span>
                      </p>
                      
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
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
                        className={`px-3 py-1 rounded text-xs font-medium border ${getStatusColor(task.status)}`}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      
                      <button
                        onClick={() => router.push(`/projects/${task.project._id}`)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
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
