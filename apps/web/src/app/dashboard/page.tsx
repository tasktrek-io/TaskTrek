"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import AuthGuard from '../../components/AuthGuard';
import Sidebar from '../../components/Sidebar';
import { useWorkspace } from '../../contexts/WorkspaceContext';

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
  assignees?: Array<{ _id: string; name: string; email: string }>;
  project: {
    _id: string;
    name: string;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [user, setUser] = useState<User | null>(null);
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
      const [userResponse, tasksResponse] = await Promise.all([
        api.get('/auth/me'),
        api.get('/tasks/assigned')
      ]);
      
      setUser(userResponse.data.user); // Updated to access nested user object
      setAssignedTasks(tasksResponse.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceData = async () => {
    if (!currentWorkspace) return;
    
    try {
      // Load projects for current workspace
      const projectsResponse = await api.get(`/projects/workspace/${currentWorkspace._id}`);
      setProjects(projectsResponse.data);
      
      // Filter assigned tasks for current workspace
      const allTasksResponse = await api.get('/tasks/assigned');
      const workspaceProjectIds = projectsResponse.data.map((p: Project) => p._id);
      const filteredTasks = allTasksResponse.data.filter((task: Task) => 
        workspaceProjectIds.includes(task.project._id)
      );
      setAssignedTasks(filteredTasks);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
      // Fallback to all user's projects and tasks
      try {
        const [allProjectsResponse, allTasksResponse] = await Promise.all([
          api.get('/projects'),
          api.get('/tasks/assigned')
        ]);
        
        const workspaceProjects = allProjectsResponse.data.filter((p: Project) => p.workspace === currentWorkspace._id);
        setProjects(workspaceProjects);
        
        const workspaceProjectIds = workspaceProjects.map((p: Project) => p._id);
        const filteredTasks = allTasksResponse.data.filter((task: Task) => 
          workspaceProjectIds.includes(task.project._id)
        );
        setAssignedTasks(filteredTasks);
      } catch (fallbackErr) {
        console.error('Fallback failed:', fallbackErr);
      }
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = user?.name?.split(' ')[0] || 'there'; // Use first name only
    
    if (hour >= 5 && hour < 12) {
      return `Good morning, ${userName}! ☀️`;
    } else if (hour >= 12 && hour < 17) {
      return `Good afternoon, ${userName}! 🌤️`;
    } else if (hour >= 17 && hour < 21) {
      return `Good evening, ${userName}! 🌅`;
    } else {
      return `Good night, ${userName}! 🌙`;
    }
  };

  const getMotivationalMessage = () => {
    const hour = new Date().getHours();
    const taskCount = assignedTasks.length;
    const completedTasks = assignedTasks.filter(t => t.status === 'done').length;
    
    if (taskCount === 0) {
      return "You're all caught up! Time to relax or plan your next project.";
    }
    
    if (completedTasks === taskCount) {
      return "Fantastic! You've completed all your tasks. Great job!";
    }
    
    if (hour >= 5 && hour < 12) {
      return "Ready to tackle the day? You've got this!";
    } else if (hour >= 12 && hour < 17) {
      return "Keep up the great momentum!";
    } else if (hour >= 17 && hour < 21) {
      return "Wrapping up the day strong!";
    } else {
      return "Working late? Don't forget to rest!";
    }
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
      <div className="min-h-screen bg-gray-50">
        <Sidebar 
          currentWorkspace={currentWorkspace || undefined} 
          onWorkspaceChange={setCurrentWorkspace}
        />
        
        <main 
          className="p-6 transition-all duration-300" 
          style={{ marginLeft: 'var(--sidebar-width, 16rem)' }}
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-lg text-gray-700 mb-1">
              {getGreeting()}
            </p>
            <p className="text-sm text-gray-600">
              {getMotivationalMessage()}
            </p>
          </div>

          {/* Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Total Projects */}
            <div className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow cursor-pointer" 
                 onClick={() => router.push('/workspaces')}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">Total Projects</div>
                <span className="text-xl">📊</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{projects.length}</div>
              <div className="text-xs text-gray-500">
                {inProgressProjects.length} in progress • {planningProjects.length} planning
              </div>
            </div>

            {/* Total Tasks */}
            <div className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow cursor-pointer"
                 onClick={() => router.push('/tasks')}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">Total Tasks</div>
                <span className="text-xl">✅</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{assignedTasks.length}</div>
              <div className="text-xs text-gray-500">
                {doneTasks.length} completed • {assignedTasks.length - doneTasks.length} remaining
              </div>
            </div>

            {/* To Do */}
            <div className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">To Do</div>
                <span className="text-xl">⏳</span>
              </div>
              <div className="text-2xl font-bold text-orange-600 mb-1">{todoTasks.length}</div>
              <div className="text-xs text-gray-500">
                {assignedTasks.filter(t => t.priority === 'urgent' && t.status === 'todo').length} urgent tasks
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">In Progress</div>
                <span className="text-xl">🚀</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mb-1">{inProgressTasks.length}</div>
              <div className="text-xs text-gray-500">
                {Math.round((inProgressTasks.length / Math.max(assignedTasks.length, 1)) * 100)}% of total tasks
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Task Priority Chart */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Task Priority</h3>
                <span className="text-gray-400">�</span>
              </div>
              <div className="text-sm text-gray-600 mb-6">Priority distribution</div>
              
              {(() => {
                const urgentTasks = assignedTasks.filter(t => t.priority === 'urgent').length;
                const highTasks = assignedTasks.filter(t => t.priority === 'high').length;
                const mediumTasks = assignedTasks.filter(t => t.priority === 'medium').length;
                const lowTasks = assignedTasks.filter(t => t.priority === 'low').length;
                const totalTasks = assignedTasks.length;
                
                if (totalTasks === 0) {
                  return (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-500">No tasks assigned yet</p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="space-y-3">
                      {urgentTasks > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">Urgent</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-red-500 h-2 rounded-full" 
                                style={{ width: `${(urgentTasks / totalTasks) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{urgentTasks}</span>
                          </div>
                        </div>
                      )}
                      
                      {highTasks > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">High</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-orange-500 h-2 rounded-full" 
                                style={{ width: `${(highTasks / totalTasks) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{highTasks}</span>
                          </div>
                        </div>
                      )}
                      
                      {mediumTasks > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">Medium</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-yellow-500 h-2 rounded-full" 
                                style={{ width: `${(mediumTasks / totalTasks) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{mediumTasks}</span>
                          </div>
                        </div>
                      )}
                      
                      {lowTasks > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">Low</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ width: `${(lowTasks / totalTasks) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{lowTasks}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Total: {totalTasks} tasks</span>
                        <span>Most: {Math.max(urgentTasks, highTasks, mediumTasks, lowTasks)} {
                          urgentTasks === Math.max(urgentTasks, highTasks, mediumTasks, lowTasks) ? 'urgent' :
                          highTasks === Math.max(urgentTasks, highTasks, mediumTasks, lowTasks) ? 'high' :
                          mediumTasks === Math.max(urgentTasks, highTasks, mediumTasks, lowTasks) ? 'medium' : 'low'
                        }</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Project Status Chart */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Project Status</h3>
                <span className="text-gray-400">�</span>
              </div>
              <div className="text-sm text-gray-600 mb-6">Status breakdown</div>
              
              {(() => {
                const completedProjects = projects.filter(p => p.status === 'completed').length;
                const inProgressProjects = projects.filter(p => p.status === 'in_progress').length;
                const planningProjects = projects.filter(p => p.status === 'planning').length;
                const onHoldProjects = projects.filter(p => p.status === 'on_hold').length;
                const totalProjects = projects.length;
                
                if (totalProjects === 0) {
                  return (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-500">No projects available yet</p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="space-y-3">
                      {completedProjects > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">Completed</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ width: `${(completedProjects / totalProjects) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{completedProjects}</span>
                          </div>
                        </div>
                      )}
                      
                      {inProgressProjects > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">In Progress</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full" 
                                style={{ width: `${(inProgressProjects / totalProjects) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{inProgressProjects}</span>
                          </div>
                        </div>
                      )}
                      
                      {planningProjects > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">Planning</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-500 h-2 rounded-full" 
                                style={{ width: `${(planningProjects / totalProjects) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{planningProjects}</span>
                          </div>
                        </div>
                      )}
                      
                      {onHoldProjects > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">On Hold</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-orange-500 h-2 rounded-full" 
                                style={{ width: `${(onHoldProjects / totalProjects) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{onHoldProjects}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Total: {totalProjects} projects</span>
                        <span>{Math.round((completedProjects / totalProjects) * 100)}% completed</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Recent Projects & Upcoming Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Projects */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-medium text-gray-900 mb-4">Recent Projects</h3>
              
              <div className="space-y-4">
                {projects.slice(0, 2).map(project => {
                  // Calculate project progress based on tasks
                  const projectTasks = assignedTasks.filter(task => task.project._id === project._id);
                  const completedProjectTasks = projectTasks.filter(task => task.status === 'done');
                  const progressPercentage = projectTasks.length > 0 
                    ? Math.round((completedProjectTasks.length / projectTasks.length) * 100) 
                    : 0;
                  
                  return (
                    <div key={project._id} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{project.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          project.status === 'completed' ? 'bg-green-100 text-green-800' :
                          project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                          project.status === 'on_hold' ? 'bg-orange-100 text-orange-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {project.status === 'in_progress' ? 'In Progress' : 
                           project.status === 'completed' ? 'Completed' :
                           project.status === 'on_hold' ? 'On Hold' : 'Planning'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">Progress ({projectTasks.length} tasks)</div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className={`h-2 rounded-full ${
                            project.status === 'completed' ? 'bg-green-500' :
                            project.status === 'in_progress' ? 'bg-blue-500' : 
                            project.status === 'on_hold' ? 'bg-orange-500' :
                            'bg-purple-500'
                          }`} 
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{progressPercentage}%</div>
                    </div>
                  );
                })}
              </div>
              
              <button 
                onClick={() => router.push('/workspaces')}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 mt-4 py-2 hover:bg-blue-50 rounded transition-colors"
              >
                View All Projects →
              </button>
            </div>

            {/* Upcoming Tasks */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-medium text-gray-900 mb-4">Upcoming Tasks</h3>
              <div className="text-sm text-gray-600 mb-4">Tasks due soon or high priority</div>
              
              <div className="space-y-3">
                {(() => {
                  // Get upcoming tasks (due within 7 days) or high/urgent priority tasks
                  const now = new Date();
                  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                  
                  const upcomingTasks = assignedTasks
                    .filter(task => {
                      if (task.status === 'done') return false;
                      
                      // Include if due within 7 days
                      if (task.dueDate) {
                        const dueDate = new Date(task.dueDate);
                        if (dueDate <= sevenDaysFromNow) return true;
                      }
                      
                      // Include if high or urgent priority
                      if (task.priority === 'urgent' || task.priority === 'high') return true;
                      
                      return false;
                    })
                    .sort((a, b) => {
                      // Sort by priority first (urgent > high > medium > low)
                      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
                      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                      if (priorityDiff !== 0) return priorityDiff;
                      
                      // Then by due date
                      if (a.dueDate && b.dueDate) {
                        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                      }
                      if (a.dueDate) return -1;
                      if (b.dueDate) return 1;
                      return 0;
                    })
                    .slice(0, 4);

                  if (upcomingTasks.length === 0) {
                    return (
                      <div className="text-center py-4">
                        <p className="text-gray-500">No urgent tasks at the moment! 🎉</p>
                        <p className="text-xs text-gray-400 mt-1">You're all caught up</p>
                      </div>
                    );
                  }

                  return upcomingTasks.map(task => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < now;
                    const isDueSoon = task.dueDate && new Date(task.dueDate) <= sevenDaysFromNow;
                    
                    return (
                      <div key={task._id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 transition-colors">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${
                          task.priority === 'urgent' ? 'bg-red-100' :
                          task.priority === 'high' ? 'bg-orange-100' :
                          task.priority === 'medium' ? 'bg-yellow-100' : 'bg-green-100'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            task.priority === 'urgent' ? 'bg-red-500' :
                            task.priority === 'high' ? 'bg-orange-500' :
                            task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
                          <p className="text-xs text-gray-600 mt-1">in {task.project.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)}`}>
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                            {task.dueDate && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                isOverdue ? 'bg-red-100 text-red-700' :
                                isDueSoon ? 'bg-yellow-100 text-yellow-700' : 'text-gray-500'
                              }`}>
                                {isOverdue ? '⚠️ Overdue' : 
                                 isDueSoon ? '⏰ Due ' + new Date(task.dueDate).toLocaleDateString() :
                                 'Due ' + new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              
              <button 
                onClick={() => router.push('/tasks')}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 mt-4 py-2 hover:bg-blue-50 rounded transition-colors"
              >
                View All My Tasks →
              </button>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
