"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

interface Workspace {
  _id: string;
  name: string;
  color: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspaces();
    
    // Listen for context changes and reload workspaces
    const handleContextChange = (event: CustomEvent) => {
      console.log('Context changed, reloading workspaces for:', event.detail.context);
      loadWorkspaces();
      // Clear current workspace when context changes
      setCurrentWorkspaceState(null);
    };

    window.addEventListener('contextChanged', handleContextChange as EventListener);
    
    return () => {
      window.removeEventListener('contextChanged', handleContextChange as EventListener);
    };
  }, []);

  const loadWorkspaces = async () => {
    try {
      // Get current context from localStorage
      const lastActiveContext = localStorage.getItem('lastActiveContext');
      let contextType = 'personal';
      let contextId = '';

      if (lastActiveContext) {
        try {
          const savedContext = JSON.parse(lastActiveContext);
          contextType = savedContext.type;
          contextId = savedContext.id;
        } catch (err) {
          console.error('Failed to parse saved context:', err);
        }
      }

      // Load workspaces for the current context
      const response = await api.get('/workspaces', {
        params: {
          contextType,
          contextId
        }
      });
      
      setWorkspaces(response.data);

      // Auto-select first workspace if workspaces exist
      if (response.data.length > 0) {
        const firstWorkspace = response.data[0];
        setCurrentWorkspaceState(firstWorkspace);
        localStorage.setItem('selectedWorkspaceId', firstWorkspace._id);
      } else {
        // Clear workspace if no workspaces exist for this context
        setCurrentWorkspaceState(null);
        localStorage.removeItem('selectedWorkspaceId');
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      // Fallback to loading all workspaces
      try {
        const response = await api.get('/workspaces');
        setWorkspaces(response.data);
        if (response.data.length > 0) {
          setCurrentWorkspaceState(response.data[0]);
          localStorage.setItem('selectedWorkspaceId', response.data[0]._id);
        }
      } catch (fallbackErr) {
        console.error('Fallback workspace loading failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const setCurrentWorkspace = (workspace: Workspace | null) => {
    if (workspace) {
      console.log('Switching to workspace:', workspace.name);
      setCurrentWorkspaceState(workspace);
      localStorage.setItem('selectedWorkspaceId', workspace._id);
    } else {
      console.log('Clearing current workspace');
      setCurrentWorkspaceState(null);
      localStorage.removeItem('selectedWorkspaceId');
    }
  };

  return (
    <WorkspaceContext.Provider value={{
      currentWorkspace,
      workspaces,
      setCurrentWorkspace,
      loading
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
