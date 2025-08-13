"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import Sidebar from '../../../components/Sidebar';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { api } from '../../../lib/api';

interface Workspace {
  _id: string;
  name: string;
  description?: string;
  color: string;
  owner: { _id: string; name: string; email: string };
  members: { _id: string; name: string; email: string }[];
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

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const loadData = async () => {
    try {
      const [workspaceRes, projectsRes] = await Promise.all([
        api.get(`/workspaces/${workspaceId}`),
        api.get(`/projects/workspace/${workspaceId}`)
      ]);
      setWorkspace(workspaceRes.data);
      setProjects(projectsRes.data);
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

  // Search for users
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        api.get(`/users/search`, { params: { email: query } })
          .then(r => setSearchResults(r.data))
          .catch(() => setSearchResults([]));
      } else {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-50 text-blue-700';
      case 'active': return 'bg-green-50 text-green-700';
      case 'on_hold': return 'bg-yellow-50 text-yellow-700';
      case 'completed': return 'bg-gray-50 text-gray-700';
      case 'cancelled': return 'bg-red-50 text-red-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Even if logout fails on server, still clear local token
    }
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3].map(i => (
                  <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const allMembers = workspace ? [workspace.owner, ...workspace.members] : [];

  return (
    <AuthGuard>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
            <button 
              onClick={() => router.push('/dashboard')}
              className="hover:text-blue-600 transition-colors"
            >
              Dashboard
            </button>
            <span>›</span>
            <button 
              onClick={() => router.push('/workspaces')}
              className="hover:text-blue-600 transition-colors"
            >
              Workspaces
            </button>
            <span>›</span>
            <span className="text-gray-900 font-medium">{workspace?.name}</span>
          </nav>

          {/* Greeting Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {getGreeting()}! Welcome to {workspace?.name}
            </h1>
            <p className="text-gray-600">
              Manage your projects and collaborate with your team
            </p>
          </div>

          {/* Workspace Info */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: workspace?.color }}
                >
                  {workspace?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{workspace?.name}</h2>
                  {workspace?.description && (
                    <p className="text-gray-600 mt-1">{workspace.description}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {allMembers.length} member{allMembers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + New Project
                </button>
                <button 
                  onClick={logout}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Projects Section */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Projects</h3>
          
          {projects.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border">
              <div className="text-gray-400 text-6xl mb-4">📂</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
              <p className="text-gray-600 mb-6">Get started by creating your first project in this workspace</p>
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
                  className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                        {project.name}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(project.status)}`}>
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('_', ' ')}
                      </span>
                    </div>
                    
                    {project.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {project.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                        {project.tags.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            +{project.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Create Project</h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={createProject} className="space-y-6">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project title
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Test Project"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Testing..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as Project['status'])}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter tags separated by commas (e.g., web, mobile, backend)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Members
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Search members by email"
                      />
                      
                      {searchResults.length > 0 && (
                        <div className="border rounded-lg max-h-32 overflow-y-auto">
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
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
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
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                              >
                                {member.name}
                                <button
                                  type="button"
                                  onClick={() => setSelectedMembers(prev => prev.filter(id => id !== memberId))}
                                  className="text-blue-600 hover:text-blue-800"
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
                      className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                    >
                      Create project
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>
    </AuthGuard>
  );
}
