"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { api } from '../../../../lib/api';
import { canDeleteWorkspace, canEditWorkspace } from '../../../../lib/permissions';

interface Workspace {
  _id: string;
  name: string;
  description?: string;
  color: string;
  owner: { _id: string; name: string; email: string };
  members: { _id: string; name: string; email: string }[];
  contextType: 'personal' | 'organization';
  contextId: string;
}

interface Project {
  _id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  startDate?: string;
  endDate?: string;
  tags: string[];
  owner: { _id: string; name: string; email: string };
  members: { _id: string; name: string; email: string }[];
  createdAt: string;
}

interface Member {
  _id: string;
  name: string;
  email: string;
}

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = params.id;
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Project['status']>('planning');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tags, setTags] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Member search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  
  // Delete workspace states
  const [showWorkspaceDeleteConfirm, setShowWorkspaceDeleteConfirm] = useState(false);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [canUserDeleteWorkspace, setCanUserDeleteWorkspace] = useState(false);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);

  // Edit workspace states
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showEditWorkspaceModal, setShowEditWorkspaceModal] = useState(false);
  const [canUserEditWorkspace, setCanUserEditWorkspace] = useState(false);
  const [workspaceEditForm, setWorkspaceEditForm] = useState({
    name: '',
    description: '',
    color: '#ff6b35'
  });

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const loadData = async () => {
    try {
      const [workspaceRes, projectsRes, userRes] = await Promise.all([
        api.get(`/workspaces/${workspaceId}`),
        api.get(`/projects/workspace/${workspaceId}`),
        api.get('/auth/me')
      ]);
      setWorkspace(workspaceRes.data);
      setProjects(projectsRes.data);
      setCurrentUser(userRes.data.user || userRes.data);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
      router.push('/workspaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      loadData();
    }
  }, [workspaceId]);

  // Check if current user can delete the workspace
  useEffect(() => {
    const checkDeletePermissions = async () => {
      if (workspace && currentUser) {
        try {
          const canDelete = await canDeleteWorkspace(workspace, currentUser._id);
          setCanUserDeleteWorkspace(canDelete);
        } catch (error) {
          console.error('Error checking delete permissions:', error);
          setCanUserDeleteWorkspace(false);
        }
      }
    };

    checkDeletePermissions();
  }, [workspace, currentUser]);

  // Check if current user can edit the workspace
  useEffect(() => {
    const checkEditPermissions = async () => {
      if (workspace && currentUser) {
        try {
          const canEdit = await canEditWorkspace(workspace, currentUser._id);
          setCanUserEditWorkspace(canEdit);
        } catch (error) {
          console.error('Error checking edit permissions:', error);
          setCanUserEditWorkspace(false);
        }
      }
    };

    checkEditPermissions();
  }, [workspace, currentUser]);

  // Close workspace menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.workspace-menu-container')) {
        setShowWorkspaceMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for users within the current workspace's context
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query && workspace) {
        api.get(`/contexts/users/search`, { 
          params: { 
            q: query,
            contextType: workspace.contextType,
            contextId: workspace.contextId
          } 
        })
          .then(r => setSearchResults(r.data))
          .catch(() => setSearchResults([]));
      } else {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, workspace]);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      const response = await api.post('/projects', {
        workspace: workspaceId,
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        members: selectedMembers
      });
      
      setProjects(prev => [response.data, ...prev]);
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create project');
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setStatus('planning');
    setStartDate('');
    setEndDate('');
    setTags('');
    setSelectedMembers([]);
    setQuery('');
    setError('');
  };

  const deleteWorkspace = async () => {
    if (!workspace) return;
    
    setIsDeletingWorkspace(true);
    try {
      await api.delete(`/workspaces/${workspace._id}`);
      
      // Redirect to workspaces list
      router.push('/workspaces');
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    } finally {
      setIsDeletingWorkspace(false);
      setShowWorkspaceDeleteConfirm(false);
    }
  };

  const openEditWorkspaceModal = () => {
    if (workspace) {
      setWorkspaceEditForm({
        name: workspace.name,
        description: workspace.description || '',
        color: workspace.color
      });
      setShowWorkspaceMenu(false);
      setShowEditWorkspaceModal(true);
    }
  };

  const updateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;

    try {
      const response = await api.patch(`/workspaces/${workspace._id}`, workspaceEditForm);
      setWorkspace(response.data);
      setShowEditWorkspaceModal(false);
    } catch (err) {
      console.error('Failed to update workspace:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
      case 'active': return 'bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300';
      case 'on_hold': return 'bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300';
      case 'completed': return 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'cancelled': return 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300';
      default: return 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Even if logout fails on server, still clear local token
    }
    localStorage.removeItem('token');
    
    // Dispatch custom logout event for socket disconnection
    window.dispatchEvent(new CustomEvent('socket:logout'));
    
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const allMembers = workspace ? [workspace.owner, ...workspace.members] : [];

  return (
    <>
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
            <button 
              onClick={() => router.push('/dashboard')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Dashboard
            </button>
            <span>›</span>
            <button 
              onClick={() => router.push('/workspaces')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Workspaces
            </button>
            <span>›</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">{workspace?.name}</span>
          </nav>

          {/* Greeting Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {getGreeting()}! Welcome to {workspace?.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your projects and collaborate with your team
            </p>
          </div>

          {/* Workspace Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: workspace?.color }}
                >
                  {workspace?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{workspace?.name}</h2>
                  {workspace?.description && (
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{workspace.description}</p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {allMembers.length} member{allMembers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  + New Project
                </button>
                
                {/* Workspace Menu */}
                {workspace && currentUser && (canUserEditWorkspace || canUserDeleteWorkspace) && (
                  <div className="relative workspace-menu-container">
                    <button
                      onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {showWorkspaceMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[160px]">
                        {/* Edit option */}
                        {canUserEditWorkspace && (
                          <button
                            onClick={openEditWorkspaceModal}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Workspace
                          </button>
                        )}
                        
                        {/* Delete option */}
                        {canUserDeleteWorkspace && (
                          <button
                            onClick={() => {
                              setShowWorkspaceMenu(false);
                              setShowWorkspaceDeleteConfirm(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Workspace
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Projects Section */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Projects</h3>
          
          {projects.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📂</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No projects yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Get started by creating your first project in this workspace</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <div
                  key={project._id}
                  onClick={() => router.push(`/projects/${project._id}`)}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 dark:text-gray-100">
                        {project.name}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(project.status)}`}>
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('_', ' ')}
                      </span>
                    </div>
                    
                    {project.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2 dark:text-gray-400">
                        {project.description}
                      </p>
                    )}
                    
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {project.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded dark:bg-gray-700 dark:text-gray-300">
                            {tag}
                          </span>
                        ))}
                        {project.tags.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded dark:bg-gray-700 dark:text-gray-300">
                            +{project.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>{project.members.length + 1} members</span>
                      {project.endDate && (
                        <span>
                          Due {new Date(project.endDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Project Modal */}
        {showCreateModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create Project</h2>
          <button
            onClick={() => {
              setShowCreateModal(false);
              resetForm();
            }}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={createProject} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Test Project"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400 resize-none"
              placeholder="Testing..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Project['status'])}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent cursor-pointer appearance-none"
                  style={{
                    colorScheme: 'light dark' // This ensures proper color scheme for the dropdown
                  }}
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {/* Custom dropdown arrow that adapts to theme */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent cursor-pointer
                    [&::-webkit-calendar-picker-indicator]:opacity-0
                    [&::-webkit-calendar-picker-indicator]:absolute
                    [&::-webkit-calendar-picker-indicator]:right-3
                    [&::-webkit-calendar-picker-indicator]:w-5
                    [&::-webkit-calendar-picker-indicator]:h-5
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  style={{
                    colorScheme: 'light dark' // This ensures proper calendar colors in both themes
                  }}
                />
                {/* Custom calendar icon */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Due Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent cursor-pointer
                    [&::-webkit-calendar-picker-indicator]:opacity-0
                    [&::-webkit-calendar-picker-indicator]:absolute
                    [&::-webkit-calendar-picker-indicator]:right-3
                    [&::-webkit-calendar-picker-indicator]:w-5
                    [&::-webkit-calendar-picker-indicator]:h-5
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  style={{
                    colorScheme: 'light dark'
                  }}
                />
                {/* Custom calendar icon */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter tags separated by commas (e.g., web, mobile, backend)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Members
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Search members by name or email"
              />
              
              {searchResults.length > 0 && (
                <div className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg max-h-32 overflow-y-auto shadow-lg">
                  {searchResults.map(user => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => {
                        if (!selectedMembers.includes(user._id)) {
                          setSelectedMembers(prev => [...prev, user._id]);
                        }
                        setQuery('');
                        setSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-200 dark:border-gray-600 last:border-b-0 transition-colors"
                    >
                      {user.name} ({user.email})
                    </button>
                  ))}
                </div>
              )}
              
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map(memberId => {
                    const member = allMembers.find(m => m._id === memberId);
                    if (!member) return null;
                    return (
                      <span
                        key={memberId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-sm border border-blue-200 dark:border-blue-800"
                      >
                        {member.name}
                        <button
                          type="button"
                          onClick={() => setSelectedMembers(prev => prev.filter(id => id !== memberId))}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors ml-1"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 dark:bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Create project
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}

        {/* Edit Workspace Modal */}
        {showEditWorkspaceModal && workspace && (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-xl border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Workspace</h2>
                  <button
                    onClick={() => setShowEditWorkspaceModal(false)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={updateWorkspace} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Workspace name
                    </label>
                    <input
                      type="text"
                      value={workspaceEditForm.name}
                      onChange={(e) => setWorkspaceEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="My Workspace"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={workspaceEditForm.description}
                      onChange={(e) => setWorkspaceEditForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                      placeholder="Workspace description..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Color
                    </label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        value={workspaceEditForm.color}
                        onChange={(e) => setWorkspaceEditForm(prev => ({ ...prev, color: e.target.value }))}
                        className="w-12 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full"
                          style={{ backgroundColor: workspaceEditForm.color }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{workspaceEditForm.color}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowEditWorkspaceModal(false)}
                      className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 dark:bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                    >
                      Update Workspace
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Delete Confirmation Modal */}
        {showWorkspaceDeleteConfirm && workspace && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Delete Workspace
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-gray-700 dark:text-gray-300">
                    Are you sure you want to delete <span className="font-semibold">"{workspace.name}"</span>? 
                    This will permanently delete the workspace, all its projects, tasks, comments, and activity history.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWorkspaceDeleteConfirm(false)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    disabled={isDeletingWorkspace}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteWorkspace}
                    disabled={isDeletingWorkspace}
                    className="flex-1 bg-red-600 dark:bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeletingWorkspace ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Workspace
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
