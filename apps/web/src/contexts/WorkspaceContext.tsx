"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
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

      // Try to restore the last selected workspace for this context
      if (response.data.length > 0) {
        const savedWorkspaceId = getWorkspaceForContext(contextId, contextType);
        const savedWorkspace = savedWorkspaceId ? 
          response.data.find((workspace: Workspace) => workspace._id === savedWorkspaceId) : null;
        
        if (savedWorkspace) {
          // Restore the saved workspace for this context
          setCurrentWorkspaceState(savedWorkspace);
        } else {
          // Select first workspace if no saved workspace found
          const firstWorkspace = response.data[0];
          setCurrentWorkspaceState(firstWorkspace);
          saveWorkspaceForContext(contextId, contextType, firstWorkspace._id);
        }
      } else {
        // Clear workspace if no workspaces exist for this context
        setCurrentWorkspaceState(null);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      // Fallback to loading all workspaces
      try {
        const response = await api.get('/workspaces');
        setWorkspaces(response.data);
        if (response.data.length > 0) {
          setCurrentWorkspaceState(response.data[0]);
          // Save with default context info
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
      
      // Save workspace with current context information
      const lastActiveContext = localStorage.getItem('lastActiveContext');
      if (lastActiveContext) {
        try {
          const savedContext = JSON.parse(lastActiveContext);
          saveWorkspaceForContext(savedContext.id, savedContext.type, workspace._id);
        } catch (err) {
          console.error('Failed to parse saved context:', err);
          // Fallback to old method
          localStorage.setItem('selectedWorkspaceId', workspace._id);
        }
      } else {
        // Fallback to old method
        localStorage.setItem('selectedWorkspaceId', workspace._id);
      }
    } else {
      console.log('Clearing current workspace');
      setCurrentWorkspaceState(null);
      // Don't remove context-specific workspace selection when clearing workspace
      // This allows restoring the workspace when switching back to the context
    }
  };

  const contextValue = useMemo(() => ({
    currentWorkspace,
    workspaces,
    setCurrentWorkspace,
    loading
  }), [currentWorkspace, workspaces, loading]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
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
