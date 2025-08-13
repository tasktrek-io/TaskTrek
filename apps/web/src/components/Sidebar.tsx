"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import NotificationBell from './NotificationBell';

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

  useEffect(() => {
    loadWorkspaces();
  }, []);

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
    router.push('/login');
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
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold">
              🔧
            </div>
            <span className="font-semibold text-lg">TaskTrek</span>
          </div>
          <NotificationBell />
        </div>

        {/* Workspace Selector */}
        {currentWorkspace && (
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
              className="w-full flex items-center justify-between p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentWorkspace.color }}
                />
                <span className="font-medium">{currentWorkspace.name}</span>
              </div>
              <span className="text-white">▼</span>
            </button>

            {showWorkspaceDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowWorkspaceDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  <div className="py-1">
                    {workspaces.map(workspace => (
                      <button
                        key={workspace._id}
                        onClick={() => handleWorkspaceChange(workspace)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: workspace.color }}
                        />
                        <span>{workspace.name}</span>
                        {workspace._id === currentWorkspace._id && (
                          <span className="ml-auto text-orange-500">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
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
          className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
        >
          <span className="text-lg">🚪</span>
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
