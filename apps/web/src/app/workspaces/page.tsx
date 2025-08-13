"use client";
import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Sidebar from '../../components/Sidebar';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { api } from '../../lib/api';
import { useRouter } from 'next/navigation';

interface Workspace {
  _id: string;
  name: string;
  description?: string;
  color: string;
  owner: { _id: string; name: string; email: string };
  members: { _id: string; name: string; email: string }[];
  createdAt: string;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#ff6b35');
  const [error, setError] = useState('');

  const colors = [
    '#ff6b35', '#f7931e', '#ffd700', '#32cd32', 
    '#00ced1', '#4169e1', '#9370db', '#ff69b4'
  ];

  const loadWorkspaces = async () => {
    try {
      const response = await api.get('/workspaces');
      setWorkspaces(response.data);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    try {
      const response = await api.post('/workspaces', {
        name: name.trim(),
        description: description.trim() || undefined,
        color
      });
      
      setWorkspaces(prev => [response.data, ...prev]);
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setColor('#ff6b35');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create workspace');
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Even if logout fails on server, still clear local token
    }
    localStorage.removeItem('token');
    localStorage.removeItem('selectedWorkspaceId');
    router.push('/auth/login');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return "Good morning! ☀️";
    } else if (hour >= 12 && hour < 17) {
      return "Good afternoon! 🌤️";
    } else if (hour >= 17 && hour < 21) {
      return "Good evening! 🌅";
    } else {
      return "Good night! 🌙";
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar 
            currentWorkspace={currentWorkspace || undefined} 
            onWorkspaceChange={setCurrentWorkspace}
          />
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
        <Sidebar 
          currentWorkspace={currentWorkspace || undefined} 
          onWorkspaceChange={setCurrentWorkspace}
        />
        
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Workspaces</h1>
            <p className="text-lg text-gray-700 mb-1">{getGreeting()}</p>
            <p className="text-sm text-gray-600">
              Organize your projects in workspaces for better collaboration
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} total
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>➕</span>
              New Workspace
            </button>
          </div>

          {/* Workspaces Grid */}
          {workspaces.length === 0 ? (
            <div className="bg-white rounded-lg border p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">🏢</div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">No workspaces found</h3>
              <p className="text-gray-600 mb-6">Create your first workspace to get started organizing projects</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Your First Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workspaces.map(workspace => (
                <div
                  key={workspace._id}
                  onClick={() => router.push(`/workspaces/${workspace._id}`)}
                  className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-blue-200"
                >
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <div
                        className="w-4 h-4 rounded-full mr-3"
                        style={{ backgroundColor: workspace.color }}
                      ></div>
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {workspace.name}
                      </h3>
                    </div>
                    
                    {workspace.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {workspace.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <span>👥</span>
                        <span>{workspace.members.length + 1} member{workspace.members.length !== 0 ? 's' : ''}</span>
                      </div>
                      <span>
                        Created {new Date(workspace.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Workspace Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Create New Workspace</h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setError('');
                      setName('');
                      setDescription('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={createWorkspace} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter workspace name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe your workspace purpose..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Workspace Color
                    </label>
                    <div className="flex gap-2">
                      {colors.map(colorOption => (
                        <button
                          key={colorOption}
                          type="button"
                          onClick={() => setColor(colorOption)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            color === colorOption ? 'border-gray-400 scale-110' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{ backgroundColor: colorOption }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setError('');
                        setName('');
                        setDescription('');
                      }}
                      className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Create Workspace
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
