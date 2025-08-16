"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import CreateOrganizationModal from './CreateOrganizationModal';
import OrganizationMembersModal from './OrganizationMembersModal';

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

interface SidebarProps {
  currentWorkspace?: Workspace;
  onWorkspaceChange?: (workspace: Workspace) => void;
  onContextChange?: (context: Context | null) => void;
}

export default function Sidebar({ currentWorkspace, onWorkspaceChange, onContextChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [currentContext, setCurrentContext] = useState<Context | null>(null);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedOrgForMembers, setSelectedOrgForMembers] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Check if device is mobile and set default collapsed state
    const checkMobileAndSetCollapsed = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      setIsCollapsed(isMobile);
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
      loadWorkspaces();
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
        api.get('/contexts/organizations')
      ]);

      const allContexts: Context[] = [
        {
          _id: personalResponse.data._id,
          name: 'Personal',
          type: 'personal',
          logo: '👤'
        },
        ...orgsResponse.data.map((org: any) => ({
          _id: org._id,
          name: org.name,
          type: 'organization' as const,
          logo: org.logo || '🏢'
        }))
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
        logo: '👤'
      };
      setContexts([defaultContext]);
      setCurrentContext(defaultContext);
    }
  };

  const loadWorkspaces = async () => {
    if (!currentContext) return;

    try {
      const response = await api.get('/workspaces', {
        params: {
          contextType: currentContext.type,
          contextId: currentContext._id
        }
      });
      setWorkspaces(response.data);

      // Auto-select first workspace if workspaces exist and no workspace is currently selected
      if (response.data.length > 0 && onWorkspaceChange) {
        // Check if current workspace belongs to the new context
        const workspaceBelongsToContext = currentWorkspace && 
          response.data.some((w: Workspace) => w._id === currentWorkspace._id);
        
        if (!currentWorkspace || !workspaceBelongsToContext) {
          // Select first workspace of the new context
          onWorkspaceChange(response.data[0]);
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

  const handleContextChange = async (context: Context) => {
    try {
      // Update context in backend
      await api.put('/contexts/context', {
        type: context.type,
        id: context._id
      });
      
      setCurrentContext(context);
      localStorage.setItem('lastActiveContext', JSON.stringify({ id: context._id, type: context.type }));
      setShowContextDropdown(false);
      
      // Clear workspaces first
      setWorkspaces([]);
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('contextChanged', { 
        detail: { context } 
      }));
      
      // Notify parent component of context change
      if (onContextChange) {
        onContextChange(context);
      }
      
      // Clear current workspace when changing context
      if (onWorkspaceChange) {
        onWorkspaceChange(null as any);
      }
      
      // Load workspaces for the new context
      await loadWorkspaces();
    } catch (error) {
      console.error('Failed to update context:', error);
    }
  };
  
  useEffect(() => {
    // Update CSS custom property for sidebar width
    const updateSidebarWidth = () => {
      document.documentElement.style.setProperty(
        '--sidebar-width', 
        isCollapsed ? '4rem' : '16rem'
      );
    };
    
    updateSidebarWidth();
  }, [isCollapsed]);

  useEffect(() => {
    // Load saved workspace from localStorage
    const savedWorkspaceId = localStorage.getItem('selectedWorkspaceId');
    if (savedWorkspaceId && workspaces.length > 0) {
      const savedWorkspace = workspaces.find(w => w._id === savedWorkspaceId);
      if (savedWorkspace && onWorkspaceChange) {
        onWorkspaceChange(savedWorkspace);
      }
    } else if (workspaces.length > 0 && onWorkspaceChange && !currentWorkspace) {
      // Set first workspace as default if none saved
      onWorkspaceChange(workspaces[0]);
    }
  }, [workspaces, onWorkspaceChange, currentWorkspace]);

  const handleWorkspaceChange = (workspace: Workspace) => {
    if (onWorkspaceChange) {
      onWorkspaceChange(workspace);
    }
    // Save selected workspace to localStorage
    localStorage.setItem('selectedWorkspaceId', workspace._id);
    setShowWorkspaceDropdown(false);
  };

  const handleOrganizationCreated = (newOrg: any) => {
    const newContext: Context = {
      _id: newOrg._id,
      name: newOrg.name,
      type: 'organization',
      logo: newOrg.logo || '🏢'
    };
    
    setContexts(prev => [...prev, newContext]);
    setCurrentContext(newContext);
    localStorage.setItem('lastActiveContext', JSON.stringify({ id: newContext._id, type: newContext.type }));
  };

  const handleManageMembers = (context: Context) => {
    if (context.type === 'organization') {
      setSelectedOrgForMembers({
        _id: context._id,
        name: context.name,
        slug: context.name.toLowerCase().replace(/\s+/g, '-'),
        ownerId: '', // Will be populated by the modal
        members: []
      });
      setShowMembersModal(true);
      setShowContextDropdown(false);
    }
  };

  const handleMembersUpdated = () => {
    // Refresh contexts to get updated member counts if needed
    loadContexts();
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('selectedWorkspaceId');
    router.push('/');
  };

  const getMenuItems = () => {
    const baseItems = [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: '📊',
      },
      {
        name: 'Workspaces',
        href: '/workspaces',
        icon: '🏢',
      },
      {
        name: 'My Tasks',
        href: '/tasks',
        icon: '✅',
      }
    ];

    // Add Members only for organization contexts
    if (currentContext && currentContext.type === 'organization') {
      baseItems.push({
        name: 'Members',
        href: '/members',
        icon: '👥',
      });
    }

    baseItems.push(
      {
        name: 'Profile',
        href: '/profile',
        icon: '👤',
      }
    );

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen flex flex-col transition-all duration-300 fixed left-0 top-0 z-30`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        {isCollapsed ? (
          // Collapsed layout - stack vertically
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold">
              🔧
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Expand sidebar"
            >
              <svg 
                className="w-4 h-4 transform rotate-180" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        ) : (
          // Expanded layout - horizontal
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center   font-bold">
                🔧
              </div>
              <span className="font-semibold text-lg text-gray-900 dark:text-white">TaskTrek</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Collapse sidebar"
              >
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Context Switcher */}
        {!isCollapsed && currentContext && (
          <div className="relative mb-3">
            <button
              onClick={() => setShowContextDropdown(!showContextDropdown)}
              className="w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentContext.logo}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {currentContext.name}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showContextDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showContextDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setShowContextDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg dark:shadow-2xl z-20 max-h-80 overflow-y-auto">
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
                      <span className="text-xl flex-shrink-0">{context.logo}</span>
                      <div className="flex flex-col flex-1">
                        <span className="font-medium">{context.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {context.type === 'personal' ? 'Personal Space' : 'Organization'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {context.type === 'organization' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManageMembers(context);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            title="Manage Members"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                            </svg>
                          </button>
                        )}
                        {currentContext._id === context._id && (
                          <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
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
                    className="w-full flex items-center gap-2 p-3 text-left border-t border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
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
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
              className="w-full flex items-center justify-between p-3 bg-orange-500 dark:bg-orange-600 text-white rounded-lg hover:bg-orange-600 dark:hover:bg-orange-700 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: currentWorkspace.color }}
                />
                <span className="font-medium text-white">{currentWorkspace.name}</span>
              </div>
              <svg 
                className={`w-4 h-4 text-white transition-transform duration-200 ${showWorkspaceDropdown ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showWorkspaceDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setShowWorkspaceDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg dark:shadow-2xl z-20 max-h-64 overflow-y-auto">
                  {workspaces.map((workspace) => (
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
                        className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500"
                        style={{ backgroundColor: workspace.color }}
                      />
                      <span className="font-medium flex-1">{workspace.name}</span>
                      {workspace._id === currentWorkspace._id && (
                        <svg 
                          className="w-4 h-4 text-orange-500 dark:text-orange-400 ml-auto" 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
          <div className="flex justify-center mt-2">
            <div 
              className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
              style={{ backgroundColor: currentWorkspace.color }}
              title={currentWorkspace.name}
            >
              <span className="text-white text-xs font-bold">
                {currentWorkspace.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
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
                  <span className={`${isCollapsed ? 'text-xl' : 'text-lg'} flex-shrink-0`}>{item.icon}</span>
                  {!isCollapsed && <span className="font-medium ml-3">{item.name}</span>}
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={logout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors group relative`}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!isCollapsed && <span className="font-medium ml-3 text-gray-600 dark:text-gray-400">Logout</span>}
          
          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
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
