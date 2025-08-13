"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import AuthGuard from '../../components/AuthGuard';
import Sidebar from '../../components/Sidebar';

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Workspace {
  _id: string;
  name: string;
  color: string;
}

interface Project {
  _id: string;
  name: string;
  status: string;
  workspace: string;
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
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      loadWorkspaceData();
    }
  }, [currentWorkspace]);

  const loadDashboardData = async () => {
    try {
      const [userResponse, workspacesResponse, tasksResponse] = await Promise.all([
        api.get('/users/me'),
        api.get('/workspaces'),
        api.get('/tasks/assigned')
      ]);
      
      setUser(userResponse.data);
      setWorkspaces(workspacesResponse.data);
      setAssignedTasks(tasksResponse.data);
      
      // Set first workspace as default
      if (workspacesResponse.data.length > 0) {
        setCurrentWorkspace(workspacesResponse.data[0]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceData = async () => {
    if (!currentWorkspace) return;
    
    try {
      const projectsResponse = await api.get(`/projects?workspace=${currentWorkspace._id}`);
      setProjects(projectsResponse.data);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AuthGuard>
    );
  }

  const todoTasks = assignedTasks.filter(t => t.status === 'todo');
  const inProgressTasks = assignedTasks.filter(t => t.status === 'in_progress');
  const doneTasks = assignedTasks.filter(t => t.status === 'done');
  
  const inProgressProjects = projects.filter(p => p.status === 'in_progress');
  const planningProjects = projects.filter(p => p.status === 'planning');

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar 
          currentWorkspace={currentWorkspace || undefined} 
          onWorkspaceChange={setCurrentWorkspace}
        />
        
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">
              {getGreeting()}, {user?.name}!
            </p>
          </div>

          {/* Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Total Projects */}
            <div className="bg-white rounded-lg border p-6">
              <div className="text-sm text-gray-600 mb-1">Total Projects</div>
              <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
              <div className="text-xs text-gray-500">{inProgressProjects.length} in progress</div>
            </div>

            {/* Total Tasks */}
            <div className="bg-white rounded-lg border p-6">
              <div className="text-sm text-gray-600 mb-1">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900">{assignedTasks.length}</div>
              <div className="text-xs text-gray-500">{doneTasks.length} completed</div>
            </div>

            {/* To Do */}
            <div className="bg-white rounded-lg border p-6">
              <div className="text-sm text-gray-600 mb-1">To Do</div>
              <div className="text-2xl font-bold text-gray-900">{todoTasks.length}</div>
              <div className="text-xs text-gray-500">Tasks waiting to be started</div>
            </div>

            {/* In Progress */}
            <div className="bg-white rounded-lg border p-6">
              <div className="text-sm text-gray-600 mb-1">In Progress</div>
              <div className="text-2xl font-bold text-gray-900">{inProgressTasks.length}</div>
              <div className="text-xs text-gray-500">Tasks currently in progress</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Task Priority Chart */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Task Priority</h3>
                <span className="text-gray-400">🕐</span>
              </div>
              <div className="text-sm text-gray-600 mb-6">Priority distribution</div>
              
              <div className="flex items-center justify-center">
                <div className="relative w-32 h-32">
                  <div className="w-32 h-32 rounded-full bg-red-500 flex items-center justify-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">
                        {assignedTasks.filter(t => t.priority === 'high').length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center mt-4 gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">High 100%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Low 0%</span>
                </div>
              </div>
            </div>

            {/* Project Status Chart */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Project Status</h3>
                <span className="text-gray-400">🕐</span>
              </div>
              <div className="text-sm text-gray-600 mb-6">Status breakdown</div>
              
              <div className="flex items-center justify-center">
                <div className="relative w-32 h-32">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-r from-blue-500 via-orange-500 to-blue-500 flex items-center justify-center">
                    <div className="w-20 h-20 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center mt-4 gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">In Progress 50%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Completed 0%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Planning 50%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Projects & Upcoming Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Projects */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-medium text-gray-900 mb-4">Recent Projects</h3>
              
              <div className="space-y-4">
                {projects.slice(0, 2).map(project => (
                  <div key={project._id} className="border-b border-gray-100 pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{project.name}</h4>
                      <span className={`px-2 py-1 rounded text-xs ${
                        project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {project.status === 'in_progress' ? 'In Progress' : 'Planning'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">Progress</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div className={`h-2 rounded-full ${
                        project.status === 'in_progress' ? 'bg-blue-500' : 'bg-purple-500'
                      }`} style={{ width: '0%' }}></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">0%</div>
                  </div>
                ))}
              </div>
              
              <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 mt-4">
                View All Projects
              </button>
            </div>

            {/* Upcoming Tasks */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-medium text-gray-900 mb-4">Upcoming Tasks</h3>
              <div className="text-sm text-gray-600 mb-4">Tasks due in the next 7 days</div>
              
              <div className="space-y-3">
                {assignedTasks.filter(task => task.dueDate).slice(0, 3).map(task => (
                  <div key={task._id} className="flex items-start gap-3">
                    <div className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        {task.dueDate && (
                          <span className="text-xs text-gray-500">
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
