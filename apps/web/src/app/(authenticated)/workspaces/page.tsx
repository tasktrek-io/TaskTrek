'use client';
import { useEffect, useState } from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { api } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import { Icons } from '../../../lib/icons';

interface Workspace {
  _id: string;
  name: string;
  description?: string;
  color: string;
  owner: { _id: string; name: string; email: string };
  members: { _id: string; name: string; email: string }[];
  contextId: string;
  contextType: 'personal' | 'organization';
  createdAt: string;
}

interface Context {
  _id: string;
  name: string;
  type: 'personal' | 'organization';
}

interface SidebarInstance {
  getCurrentContext: () => Context | null;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentContext, setCurrentContext] = useState<Context | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#ff6b35');
  const [error, setError] = useState('');

  const colors = [
    '#ff6b35',
    '#f7931e',
    '#ffd700',
    '#32cd32',
    '#00ced1',
    '#4169e1',
    '#9370db',
    '#ff69b4',
  ];

  const loadWorkspaces = async () => {
    try {
      let response;
      if (currentContext) {
        console.log('Loading workspaces for context:', currentContext);
        // Load workspaces for the current context
        response = await api.get('/workspaces', {
          params: {
            contextType: currentContext.type,
            contextId: currentContext._id,
          },
        });
      } else {
        console.log('No current context, loading all workspaces');
        // Fallback to all workspaces if no context
        response = await api.get('/workspaces');
      }
      setWorkspaces(response.data);
      console.log('Loaded workspaces:', response.data);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [currentContext]);

  // Listen for context changes from the sidebar
  useEffect(() => {
    const handleContextChange = (event: CustomEvent) => {
      setCurrentContext(event.detail.context);
    };

    // Listen for custom context change events
    window.addEventListener('contextChanged', handleContextChange as EventListener);

    // Also check localStorage for the current context
    const lastActiveContext = localStorage.getItem('lastActiveContext');
    if (lastActiveContext) {
      try {
        const savedContext = JSON.parse(lastActiveContext);
        // We need to fetch the context details from the API
        fetchCurrentContext(savedContext.id, savedContext.type);
      } catch (err) {
        console.error('Failed to parse saved context:', err);
      }
    }

    return () => {
      window.removeEventListener('contextChanged', handleContextChange as EventListener);
    };
  }, []);

  const fetchCurrentContext = async (
    contextId: string,
    contextType: 'personal' | 'organization'
  ) => {
    try {
      if (contextType === 'personal') {
        const response = await api.get('/contexts/personal-space');
        setCurrentContext({
          _id: response.data._id,
          name: 'Personal',
          type: 'personal',
        });
      } else {
        const response = await api.get('/contexts/organizations');
        const org = response.data.find((org: any) => org._id === contextId);
        if (org) {
          setCurrentContext({
            _id: org._id,
            name: org.name,
            type: 'organization',
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch current context:', err);
    }
  };

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    if (!currentContext) {
      setError('No context selected. Please try refreshing the page.');
      return;
    }

    try {
      const response = await api.post('/workspaces', {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        contextType: currentContext.type,
        contextId: currentContext._id,
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

    // Dispatch custom logout event for socket disconnection
    window.dispatchEvent(new CustomEvent('socket:logout'));

    router.push('/');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning!';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon!';
    } else if (hour >= 17 && hour < 21) {
      return 'Good evening!';
    } else {
      return 'Good night!';
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400'></div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2'>Workspaces</h1>
        <p className='text-lg text-gray-700 dark:text-gray-300 mb-1'>{getGreeting()}</p>
        <p className='text-sm text-gray-600 dark:text-gray-400'>
          Organize your projects in workspaces for better collaboration
        </p>
        {currentContext && (
          <p className='text-sm text-blue-600 dark:text-blue-400 mt-2'>
            Current context: {currentContext.name} ({currentContext.type})
          </p>
        )}
      </div>

      {/* Action Bar */}
      <div className='flex justify-between items-center mb-8'>
        <div className='flex items-center gap-4'>
          <div className='text-sm text-gray-600 dark:text-gray-400'>
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} total
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className='bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2'
        >
          <span>➕</span>
          New Workspace
        </button>
      </div>

      {/* Workspaces Grid */}
      {workspaces.length === 0 ? (
        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center'>
          <Icons.Building2 className='w-24 h-24 text-gray-400 dark:text-gray-500 mb-4' />
          <h3 className='text-xl font-medium text-gray-900 dark:text-gray-100 mb-2'>
            No workspaces found
          </h3>
          <p className='text-gray-600 dark:text-gray-400 mb-6'>
            Create your first workspace to get started organizing projects
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className='bg-blue-600 dark:bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors'
          >
            Create Your First Workspace
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {workspaces.map(workspace => (
            <div
              key={workspace._id}
              onClick={() => router.push(`/workspaces/${workspace._id}`)}
              className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-blue-200 dark:hover:border-blue-600'
            >
              <div className='p-6'>
                <div className='flex items-center mb-4'>
                  <div
                    className='w-4 h-4 rounded-full mr-3'
                    style={{ backgroundColor: workspace.color }}
                  ></div>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 truncate'>
                    {workspace.name}
                  </h3>
                </div>

                {workspace.description && (
                  <p className='text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2'>
                    {workspace.description}
                  </p>
                )}

                <div className='flex items-center justify-between text-sm text-gray-500 dark:text-gray-400'>
                  <div className='flex items-center gap-1'>
                    <span>👥</span>
                    <span>
                      {workspace.members.length + 1} member
                      {workspace.members.length !== 0 ? 's' : ''}
                    </span>
                  </div>
                  <span>Created {new Date(workspace.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                Create New Workspace
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                  setName('');
                  setDescription('');
                }}
                className='text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              >
                ✕
              </button>
            </div>

            <form onSubmit={createWorkspace} className='space-y-4'>
              {error && (
                <div className='bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-200 px-4 py-3 rounded'>
                  {error}
                </div>
              )}

              {currentContext && (
                <div className='bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-200 px-4 py-3 rounded'>
                  Creating workspace in: <strong>{currentContext.name}</strong> (
                  {currentContext.type === 'personal' ? 'Personal' : 'Organization'})
                </div>
              )}

              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Workspace Name
                </label>
                <input
                  type='text'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                  placeholder='Enter workspace name'
                  required
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className='w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                  placeholder='Describe your workspace purpose...'
                  rows={3}
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Workspace Color
                </label>
                <div className='flex gap-2'>
                  {colors.map(colorOption => (
                    <button
                      key={colorOption}
                      type='button'
                      onClick={() => setColor(colorOption)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        color === colorOption
                          ? 'border-gray-400 dark:border-gray-500 scale-110'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: colorOption }}
                    />
                  ))}
                </div>
              </div>

              <div className='flex gap-3 pt-4'>
                <button
                  type='button'
                  onClick={() => {
                    setShowCreateModal(false);
                    setError('');
                    setName('');
                    setDescription('');
                  }}
                  className='flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  className='flex-1 bg-blue-600 dark:bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors'
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
