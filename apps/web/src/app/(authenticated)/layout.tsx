'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

interface SidebarWorkspace {
  _id: string;
  name: string;
  color: string;
  contextId: string;
  contextType: 'personal' | 'organization';
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Convert workspace to the format expected by Sidebar
  const sidebarWorkspace: SidebarWorkspace | undefined = useMemo(
    () =>
      currentWorkspace
        ? {
            _id: currentWorkspace._id,
            name: currentWorkspace.name,
            color: currentWorkspace.color,
            contextId: currentWorkspace._id, // Use workspace ID as context ID for now
            contextType: 'organization' as const, // Default to organization context
          }
        : undefined,
    [currentWorkspace]
  );

  useEffect(() => {
    loadUserData();
  }, []);

  // Listen for context changes to update workspace
  useEffect(() => {
    const handleContextChange = (event: CustomEvent) => {
      console.log('Layout: Context changed, clearing workspace');
      // Clear current workspace when context changes
      setCurrentWorkspace(null);
    };

    window.addEventListener('contextChanged', handleContextChange as EventListener);

    return () => {
      window.removeEventListener('contextChanged', handleContextChange as EventListener);
    };
  }, [setCurrentWorkspace]);

  const loadUserData = useCallback(async () => {
    try {
      const userResponse = await api.get('/auth/me');
      setUser(userResponse.data.user);
    } catch (err) {
      console.error('Failed to load user data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400'></div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <Sidebar currentWorkspace={sidebarWorkspace} onWorkspaceChange={setCurrentWorkspace} />

        <main className='p-6 transition-all duration-300 md:ml-[var(--sidebar-width,16rem)] pb-20 md:pb-6 pt-20 md:pt-6'>
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
