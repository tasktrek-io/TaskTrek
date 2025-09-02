'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import CreateOrganizationModal from './CreateOrganizationModal';
import OrganizationMembersModal from './OrganizationMembersModal';
import { Icons } from '../lib/icons';
import { useSocket } from '../contexts/SocketContext';
import { logout as socketLogout } from '../lib/socket-auth';

interface Workspace {
  _id: string;
  name: string;
  color: string;
  contextId: string;
  contextType: 'personal' | 'organization';
}

interface Context {
  _id: string;
  name: string;
  type: 'personal' | 'organization';
  logo?: string;
}

interface MenuItem {
  name: string;
  href: string;
  icon: string | React.ReactElement;
}

interface SidebarProps {
  currentWorkspace?: Workspace;
  onWorkspaceChange?: (workspace: Workspace) => void;
  onContextChange?: (context: Context | null) => void;
}

export default function Sidebar({
  currentWorkspace,
  onWorkspaceChange,
  onContextChange,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useSocket();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [currentContext, setCurrentContext] = useState<Context | null>(null);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedOrgForMembers, setSelectedOrgForMembers] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if device is mobile and set default collapsed state
    const checkMobileAndSetCollapsed = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
      setIsCollapsed(mobile);
    };

    // Set initial state
    checkMobileAndSetCollapsed();

    // Listen for window resize
    window.addEventListener('resize', checkMobileAndSetCollapsed);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobileAndSetCollapsed);
    };
  }, []);

  useEffect(() => {
    loadContexts();
  }, []);

  useEffect(() => {
    if (currentContext) {
      loadWorkspacesAndRestoreSelection(currentContext);
      // Notify parent of context change
      if (onContextChange) {
        onContextChange(currentContext);
      }
    }
  }, [currentContext, onContextChange]);

  const loadContexts = async () => {
    try {
      // Load personal space and organizations
      const [personalResponse, orgsResponse] = await Promise.all([
        api.get('/contexts/personal-space'),
        api.get('/contexts/organizations'),
      ]);

      const allContexts: Context[] = [
        {
          _id: personalResponse.data._id,
          name: 'Personal',
          type: 'personal',
          logo: '👤',
        },
        ...orgsResponse.data.map((org: any) => ({
          _id: org._id,
          name: org.name,
          type: 'organization' as const,
          logo: org.logo || <Icons.Building2 className='w-5 h-5' />,
        })),
      ];

      setContexts(allContexts);

      // Load last active context or default to personal
      const lastActiveContext = localStorage.getItem('lastActiveContext');
      if (lastActiveContext) {
        const savedContext = JSON.parse(lastActiveContext);
        const foundContext = allContexts.find(c => c._id === savedContext.id);
        if (foundContext) {
          setCurrentContext(foundContext);
        } else if (allContexts.length > 0) {
          setCurrentContext(allContexts[0]);
        }
      } else if (allContexts.length > 0) {
        setCurrentContext(allContexts[0]);
      }
    } catch (err) {
      console.error('Failed to load contexts:', err);
      // Create a default personal context if API fails
      const defaultContext: Context = {
        _id: 'personal-default',
        name: 'Personal',
        type: 'personal',
        logo: '👤',
      };
      setContexts([defaultContext]);
      setCurrentContext(defaultContext);
    }
  };

  // Helper functions for localStorage management
  const getWorkspaceKey = (contextId: string, contextType: string) => {
    return `selectedWorkspaceId_${contextType}_${contextId}`;
  };

  const saveWorkspaceForContext = (contextId: string, contextType: string, workspaceId: string) => {
    const key = getWorkspaceKey(contextId, contextType);
    localStorage.setItem(key, workspaceId);
    // Also maintain backward compatibility
    localStorage.setItem('selectedWorkspaceId', workspaceId);
  };

  const getWorkspaceForContext = (contextId: string, contextType: string) => {
    const key = getWorkspaceKey(contextId, contextType);
    return localStorage.getItem(key);
  };

  const loadWorkspaces = async () => {
    if (!currentContext) return;

    try {
      const response = await api.get('/workspaces', {
        params: {
          contextType: currentContext.type,
          contextId: currentContext._id,
        },
      });
      setWorkspaces(response.data);

      // Auto-select first workspace if workspaces exist and no workspace is currently selected
      if (response.data.length > 0 && onWorkspaceChange) {
        // Check if current workspace belongs to the new context
        const workspaceBelongsToContext =
          currentWorkspace && response.data.some((w: Workspace) => w._id === currentWorkspace._id);

        if (!currentWorkspace || !workspaceBelongsToContext) {
          // Select first workspace of the new context
          onWorkspaceChange(response.data[0]);
          saveWorkspaceForContext(currentContext._id, currentContext.type, response.data[0]._id);
        }
      } else if (response.data.length === 0 && onWorkspaceChange) {
        // Clear workspace if no workspaces exist for this context
        onWorkspaceChange(null as any);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      // Fallback to old API for backward compatibility
      try {
        const response = await api.get('/workspaces');
        setWorkspaces(response.data);
      } catch (fallbackErr) {
        console.error('Fallback workspace loading failed:', fallbackErr);
      }
    }
  };

  const loadWorkspacesAndRestoreSelection = async (context: Context) => {
    try {
      const response = await api.get('/workspaces', {
        params: {
          contextType: context.type,
          contextId: context._id,
        },
      });
      setWorkspaces(response.data);

      if (response.data.length > 0 && onWorkspaceChange) {
        // Try to restore the last selected workspace for this context
        const savedWorkspaceId = getWorkspaceForContext(context._id, context.type);
        const savedWorkspace = savedWorkspaceId
          ? response.data.find((w: Workspace) => w._id === savedWorkspaceId)
          : null;

        if (savedWorkspace) {
          // Restore the saved workspace for this context
          onWorkspaceChange(savedWorkspace);
        } else {
          // Select first workspace if no saved workspace found
          onWorkspaceChange(response.data[0]);
          saveWorkspaceForContext(context._id, context.type, response.data[0]._id);
        }
      } else if (response.data.length === 0 && onWorkspaceChange) {
        // Clear workspace if no workspaces exist for this context
        onWorkspaceChange(null as any);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      // Fallback to old API for backward compatibility
      try {
        const response = await api.get('/workspaces');
        setWorkspaces(response.data);
        if (response.data.length > 0 && onWorkspaceChange) {
          onWorkspaceChange(response.data[0]);
          saveWorkspaceForContext(context._id, context.type, response.data[0]._id);
        }
      } catch (fallbackErr) {
        console.error('Fallback workspace loading failed:', fallbackErr);
      }
    }
  };

  const handleContextChange = useCallback(
    async (context: Context) => {
      try {
        // Update context in backend
        await api.put('/contexts/context', {
          type: context.type,
          id: context._id,
        });

        setCurrentContext(context);
        localStorage.setItem(
          'lastActiveContext',
          JSON.stringify({ id: context._id, type: context.type })
        );
        setShowContextDropdown(false);

        // Clear workspaces first
        setWorkspaces([]);

        // Dispatch custom event to notify other components
        window.dispatchEvent(
          new CustomEvent('contextChanged', {
            detail: { context },
          })
        );

        // Notify parent component of context change
        if (onContextChange) {
          onContextChange(context);
        }

        // Clear current workspace temporarily
        if (onWorkspaceChange) {
          onWorkspaceChange(null as any);
        }

        // Load workspaces for the new context and restore saved workspace
        await loadWorkspacesAndRestoreSelection(context);
      } catch (error) {
        console.error('Failed to update context:', error);
      }
    },
    [onContextChange, onWorkspaceChange]
  );

  const handleWorkspaceChange = useCallback(
    (workspace: Workspace) => {
      if (onWorkspaceChange) {
        onWorkspaceChange(workspace);
      }
      // Save selected workspace for the current context
      if (currentContext) {
        saveWorkspaceForContext(currentContext._id, currentContext.type, workspace._id);
      }
      setShowWorkspaceDropdown(false);
    },
    [onWorkspaceChange, currentContext]
  );

  const logout = useCallback(() => {
    socketLogout(router, '/');
  }, [router]);

  const handleOrganizationCreated = useCallback((newOrg: any) => {
    const newContext: Context = {
      _id: newOrg._id,
      name: newOrg.name,
      type: 'organization',
      logo: newOrg.logo || '🏢',
    };

    setContexts(prev => [...prev, newContext]);
    setCurrentContext(newContext);
    localStorage.setItem(
      'lastActiveContext',
      JSON.stringify({ id: newContext._id, type: newContext.type })
    );
  }, []);

  const handleManageMembers = useCallback((context: Context) => {
    if (context.type === 'organization') {
      setSelectedOrgForMembers({
        _id: context._id,
        name: context.name,
        slug: context.name.toLowerCase().replace(/\s+/g, '-'),
        ownerId: '', // Will be populated by the modal
        members: [],
      });
      setShowMembersModal(true);
      setShowContextDropdown(false);
    }
  }, []);

  const handleMembersUpdated = useCallback(() => {
    // Refresh contexts to get updated member counts if needed
    loadContexts();
  }, []);

  useEffect(() => {
    // Update CSS custom property for sidebar width
    const updateSidebarWidth = () => {
      if (isMobile) {
        // Mobile: no sidebar width, but add bottom padding for bottom nav and top padding for header
        document.documentElement.style.setProperty('--sidebar-width', '0rem');
        document.documentElement.style.setProperty('--bottom-nav-height', '4rem');
        document.documentElement.style.setProperty('--mobile-header-height', '4rem');
      } else {
        // Desktop: sidebar width
        document.documentElement.style.setProperty(
          '--sidebar-width',
          isCollapsed ? '4rem' : '16rem'
        );
        document.documentElement.style.setProperty('--bottom-nav-height', '0rem');
        document.documentElement.style.setProperty('--mobile-header-height', '0rem');
      }
    };

    updateSidebarWidth();
  }, [isCollapsed, isMobile]);

  const getMenuItems = (): MenuItem[] => {
    const baseItems = [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: <Icons.BarChart3 className='w-5 h-5' />,
      },
      {
        name: 'Workspaces',
        href: '/workspaces',
        icon: <Icons.Building2 className='w-5 h-5' />,
      },
      {
        name: 'My Tasks',
        href: '/tasks',
        icon: <Icons.CheckCircle className='w-5 h-5' />,
      },
    ];

    // Add Members only for organization contexts
    if (currentContext && currentContext.type === 'organization') {
      baseItems.push({
        name: 'Members',
        href: '/members',
        icon: <Icons.Users className='w-5 h-5' />,
      });
    }

    baseItems.push({
      name: 'Profile',
      href: '/profile',
      icon: <Icons.User className='w-5 h-5' />,
    });

    return baseItems;
  };

  const menuItems = getMenuItems();

  // Mobile bottom navigation
  if (isMobile) {
    return (
      <>
        {/* Mobile Header */}
        <div className='fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 md:hidden'>
          <div className='flex items-center justify-between p-4'>
            {/* Left side - Logo */}
            <div className='flex items-center gap-2'>
              <div className='w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold'>
                <Icons.Settings className='w-5 h-5' />
              </div>
              <span className='font-semibold text-lg text-gray-900 dark:text-white'>TaskTrek</span>
            </div>

            {/* Right side - Notifications and Theme Toggle */}
            <div className='flex items-center gap-2'>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className='fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 md:hidden'>
          <div className='flex items-center justify-around py-2'>
            {menuItems.slice(0, 3).map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors relative ${
                    isActive
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <div className='relative'>
                    {typeof item.icon === 'string' ? (
                      <span className='text-lg'>{item.icon}</span>
                    ) : (
                      <span>{item.icon}</span>
                    )}
                  </div>
                  <span className='text-xs font-medium'>{item.name}</span>
                </Link>
              );
            })}

            {/* More menu for additional items */}
            <button
              onClick={() => setShowContextDropdown(!showContextDropdown)}
              className='flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors text-gray-600 dark:text-gray-400'
            >
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 6h16M4 12h16M4 18h16'
                />
              </svg>
              <span className='text-xs font-medium'>More</span>
            </button>
          </div>

          {/* Mobile context/workspace selector dropdown */}
          {showContextDropdown && (
            <>
              <div className='fixed inset-0 z-40' onClick={() => setShowContextDropdown(false)} />
              <div className='absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg dark:shadow-2xl z-50 max-h-80 overflow-y-auto'>
                {/* Context Switcher */}
                {currentContext && (
                  <div className='p-4 border-b border-gray-200 dark:border-gray-600'>
                    <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      Current Context
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className='text-lg'>{currentContext.logo}</span>
                      <span className='font-medium text-gray-900 dark:text-gray-100'>
                        {currentContext.name}
                      </span>
                    </div>

                    {/* Switch Context */}
                    <div className='mt-3'>
                      <div className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-2'>
                        Switch Context
                      </div>
                      <div className='space-y-1'>
                        {contexts
                          .filter(ctx => ctx._id !== currentContext._id)
                          .map(context => (
                            <button
                              key={context._id}
                              onClick={() => handleContextChange(context)}
                              className='w-full flex items-center gap-2 p-2 text-left rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                            >
                              <span className='text-sm'>
                                {context.logo === '👤' ? (
                                  <Icons.User className='w-4 h-4' />
                                ) : context.logo === '🏢' ? (
                                  <Icons.Building2 className='w-4 h-4' />
                                ) : (
                                  context.logo
                                )}
                              </span>
                              <span className='text-sm font-medium'>{context.name}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Workspace Selector */}
                {currentWorkspace && workspaces.length > 0 && (
                  <div className='p-4 border-b border-gray-200 dark:border-gray-600'>
                    <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      Current Workspace
                    </div>
                    <div className='flex items-center gap-2'>
                      <div
                        className='w-3 h-3 rounded-full'
                        style={{ backgroundColor: currentWorkspace.color }}
                      />
                      <span className='font-medium text-gray-900 dark:text-gray-100'>
                        {currentWorkspace.name}
                      </span>
                    </div>

                    {/* Switch Workspace */}
                    {workspaces.length > 1 && (
                      <div className='mt-3'>
                        <div className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-2'>
                          Switch Workspace
                        </div>
                        <div className='space-y-1'>
                          {workspaces
                            .filter(ws => ws._id !== currentWorkspace._id)
                            .map(workspace => (
                              <button
                                key={workspace._id}
                                onClick={() => handleWorkspaceChange(workspace)}
                                className='w-full flex items-center gap-2 p-2 text-left rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                              >
                                <div
                                  className='w-3 h-3 rounded-full'
                                  style={{ backgroundColor: workspace.color }}
                                />
                                <span className='text-sm font-medium'>{workspace.name}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Menu Items */}
                <div className='p-4 border-b border-gray-200 dark:border-gray-600'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    Quick Actions
                  </div>
                  <div className='space-y-1'>
                    {/* Profile Link */}
                    <Link
                      href='/profile'
                      onClick={() => setShowContextDropdown(false)}
                      className={`w-full flex items-center gap-2 p-2 text-left rounded transition-colors ${
                        pathname === '/profile'
                          ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className='relative'>
                        <Icons.User className='w-4 h-4' />
                        {/* Connection status indicator */}
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white ${
                            isConnected ? 'bg-green-500' : 'bg-yellow-500'
                          }`}
                        />
                      </div>
                      <span className='text-sm font-medium'>Profile</span>
                    </Link>

                    {/* Members link for organizations */}
                    {currentContext && currentContext.type === 'organization' && (
                      <Link
                        href='/members'
                        onClick={() => setShowContextDropdown(false)}
                        className={`w-full flex items-center gap-2 p-2 text-left rounded transition-colors ${
                          pathname === '/members'
                            ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icons.Users className='w-4 h-4' />
                        <span className='text-sm font-medium'>Members</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Additional Options */}
                <div className='p-4'>
                  <button
                    onClick={() => {
                      setShowContextDropdown(false);
                      setShowCreateOrgModal(true);
                    }}
                    className='w-full flex items-center gap-2 p-2 text-left text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors'
                  >
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                      />
                    </svg>
                    <span className='text-sm'>Create Organization</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowContextDropdown(false);
                      logout();
                    }}
                    className='w-full flex items-center gap-2 p-2 text-left text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors mt-2'
                  >
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
                      />
                    </svg>
                    <span className='text-sm'>Logout</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Create Organization Modal */}
        <CreateOrganizationModal
          isOpen={showCreateOrgModal}
          onClose={() => setShowCreateOrgModal(false)}
          onOrganizationCreated={handleOrganizationCreated}
        />

        {/* Organization Members Modal */}
        <OrganizationMembersModal
          isOpen={showMembersModal}
          onClose={() => {
            setShowMembersModal(false);
            setSelectedOrgForMembers(null);
          }}
          organization={selectedOrgForMembers}
          onUpdate={handleMembersUpdated}
        />
      </>
    );
  }

  // Desktop sidebar
  return (
    <div
      className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen flex flex-col transition-all duration-300 fixed left-0 top-0 z-30 hidden md:flex`}
    >
      {/* Header */}
      <div className='p-4 border-b border-gray-200'>
        {isCollapsed ? (
          // Collapsed layout - stack vertically
          <div className='flex flex-col items-center gap-3 mb-4'>
            <div className='w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold'>
              <Icons.Settings className='w-5 h-5' />
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className='p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors'
              title='Expand sidebar'
            >
              <svg
                className='w-4 h-4 transform rotate-180'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M11 19l-7-7 7-7m8 14l-7-7 7-7'
                />
              </svg>
            </button>
          </div>
        ) : (
          // Expanded layout - horizontal
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <div className='w-8 h-8 bg-orange-500 rounded flex items-center justify-center font-bold'>
                <Icons.Settings className='w-5 h-5' />
              </div>
              <span className='font-semibold text-lg text-gray-900 dark:text-white'>TaskTrek</span>
            </div>
            <div className='flex items-center gap-2'>
              <NotificationBell />
              <ThemeToggle />
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className='p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors'
                title='Collapse sidebar'
              >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M11 19l-7-7 7-7m8 14l-7-7 7-7'
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Context Switcher */}
        {!isCollapsed && currentContext && (
          <div className='relative mb-3'>
            <button
              onClick={() => setShowContextDropdown(!showContextDropdown)}
              className='w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
            >
              <div className='flex items-center gap-2'>
                <span className='text-xl'>{currentContext.logo}</span>
                <span className='font-medium text-gray-900 dark:text-gray-100'>
                  {currentContext.name}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showContextDropdown ? 'rotate-180' : ''}`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>

            {showContextDropdown && (
              <>
                <div className='fixed inset-0 z-10' onClick={() => setShowContextDropdown(false)} />
                <div className='absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg dark:shadow-2xl z-20 max-h-80 overflow-y-auto'>
                  {contexts.map(context => (
                    <button
                      key={context._id}
                      onClick={() => handleContextChange(context)}
                      className={`w-full flex items-center gap-3 p-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        currentContext._id === context._id
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className='text-xl flex-shrink-0'>
                        {context.logo === '👤' ? (
                          <Icons.User className='w-5 h-5' />
                        ) : context.logo === '🏢' ? (
                          <Icons.Building2 className='w-5 h-5' />
                        ) : (
                          context.logo
                        )}
                      </span>
                      <div className='flex flex-col flex-1'>
                        <span className='font-medium'>{context.name}</span>
                        <span className='text-xs text-gray-500 dark:text-gray-400'>
                          {context.type === 'personal' ? 'Personal Space' : 'Organization'}
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        {context.type === 'organization' && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleManageMembers(context);
                            }}
                            className='p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors'
                            title='Manage Members'
                          >
                            <svg
                              className='w-4 h-4'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'
                              />
                            </svg>
                          </button>
                        )}
                        {currentContext._id === context._id && (
                          <svg
                            className='w-4 h-4 text-blue-500 dark:text-blue-400'
                            fill='currentColor'
                            viewBox='0 0 20 20'
                          >
                            <path
                              fillRule='evenodd'
                              d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                              clipRule='evenodd'
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Create New Organization button */}
                  <button
                    onClick={() => {
                      setShowContextDropdown(false);
                      setShowCreateOrgModal(true);
                    }}
                    className='w-full flex items-center gap-2 p-3 text-left border-t border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                  >
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                      />
                    </svg>
                    <span>Create New Organization</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Workspace Selector */}
        {currentContext && workspaces.length > 0 && currentWorkspace && !isCollapsed && (
          <div className='relative'>
            <button
              onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
              className='w-full flex items-center justify-between p-3 bg-orange-500 dark:bg-orange-600 text-white rounded-lg hover:bg-orange-600 dark:hover:bg-orange-700 transition-colors shadow-sm'
            >
              <div className='flex items-center gap-2'>
                <div
                  className='w-3 h-3 rounded-full border border-white/20'
                  style={{ backgroundColor: currentWorkspace.color }}
                />
                <span className='font-medium text-white'>{currentWorkspace.name}</span>
              </div>
              <svg
                className={`w-4 h-4 text-white transition-transform duration-200 ${showWorkspaceDropdown ? 'rotate-180' : ''}`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>

            {showWorkspaceDropdown && (
              <>
                <div
                  className='fixed inset-0 z-10'
                  onClick={() => setShowWorkspaceDropdown(false)}
                />
                <div className='absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg dark:shadow-2xl z-20 max-h-64 overflow-y-auto'>
                  {workspaces.map(workspace => (
                    <button
                      key={workspace._id}
                      onClick={() => handleWorkspaceChange(workspace)}
                      className={`w-full flex items-center gap-2 p-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        currentWorkspace._id === workspace._id
                          ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div
                        className='w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500'
                        style={{ backgroundColor: workspace.color }}
                      />
                      <span className='font-medium flex-1'>{workspace.name}</span>
                      {workspace._id === currentWorkspace._id && (
                        <svg
                          className='w-4 h-4 text-orange-500 dark:text-orange-400 ml-auto'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                        >
                          <path
                            fillRule='evenodd'
                            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                            clipRule='evenodd'
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Workspace indicator for collapsed state */}
        {currentWorkspace && isCollapsed && (
          <div className='flex justify-center mt-2'>
            <div
              className='w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center'
              style={{ backgroundColor: currentWorkspace.color }}
              title={currentWorkspace.name}
            >
              <span className='text-white text-xs font-bold'>
                {currentWorkspace.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className='flex-1 p-4'>
        <ul className='space-y-2'>
          {menuItems.map(item => {
            const isActive = pathname === item.href;
            const isProfileTab = item.name === 'Profile';
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg transition-colors group relative ${
                    isActive
                      ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <div className='relative flex-shrink-0'>
                    {typeof item.icon === 'string' ? (
                      <span className={`${isCollapsed ? 'text-xl' : 'text-lg'}`}>{item.icon}</span>
                    ) : (
                      <span>{item.icon}</span>
                    )}
                    {/* Connection status indicator for Profile tab */}
                    {isProfileTab && (
                      <span
                        className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white ${
                          isConnected ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        title={
                          isConnected
                            ? 'Connected to real-time notifications'
                            : 'Using fallback mode'
                        }
                      />
                    )}
                  </div>
                  {!isCollapsed && <span className='font-medium ml-3'>{item.name}</span>}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className='absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50'>
                      {item.name}
                      {isProfileTab && (
                        <div className='text-xs mt-1 opacity-80'>
                          {isConnected ? '🟢 Real-time' : '🟡 Fallback'}
                        </div>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className='p-4 border-t border-gray-200'>
        <button
          onClick={logout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors group relative`}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <svg
            className='w-5 h-5 flex-shrink-0'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
            />
          </svg>
          {!isCollapsed && (
            <span className='font-medium ml-3 text-gray-600 dark:text-gray-400'>Logout</span>
          )}

          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className='absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50'>
              Logout
            </div>
          )}
        </button>
      </div>

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
        onOrganizationCreated={handleOrganizationCreated}
      />

      {/* Organization Members Modal */}
      <OrganizationMembersModal
        isOpen={showMembersModal}
        onClose={() => {
          setShowMembersModal(false);
          setSelectedOrgForMembers(null);
        }}
        organization={selectedOrgForMembers}
        onUpdate={handleMembersUpdated}
      />
    </div>
  );
}
