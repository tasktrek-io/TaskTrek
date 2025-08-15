"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';

interface Workspace {
  _id: string;
  name: string;
  color: string;
}

interface SidebarProps {
  currentWorkspace?: Workspace;
  onWorkspaceChange?: (workspace: Workspace) => void;
}

export default function Sidebar({ currentWorkspace, onWorkspaceChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
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
    loadWorkspaces();
  }, []);
  
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
    } else if (workspaces.length > 0 && onWorkspaceChange) {
      // Set first workspace as default if none saved
      onWorkspaceChange(workspaces[0]);
    }
  }, [workspaces, onWorkspaceChange]);

  const loadWorkspaces = async () => {
    try {
      const response = await api.get('/workspaces');
      setWorkspaces(response.data);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  };

  const handleWorkspaceChange = (workspace: Workspace) => {
    if (onWorkspaceChange) {
      onWorkspaceChange(workspace);
    }
    // Save selected workspace to localStorage
    localStorage.setItem('selectedWorkspaceId', workspace._id);
    setShowWorkspaceDropdown(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('selectedWorkspaceId');
    router.push('/');
  };

  const menuItems = [
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
    },
    {
      name: 'Members',
      href: '/members',
      icon: '👥',
    },
    {
      name: 'Achieved',
      href: '/achieved',
      icon: '🏆',
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: '⚙️',
    },
  ];

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

        {/* Workspace Selector */}
        {currentWorkspace && !isCollapsed && (
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
    </div>
  );
}
