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
  setCurrentWorkspace: (workspace: Workspace) => void;
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
  }, []);

  const loadWorkspaces = async () => {
    try {
      const response = await api.get('/workspaces');
      setWorkspaces(response.data);

      // Load saved workspace from localStorage
      const savedWorkspaceId = localStorage.getItem('selectedWorkspaceId');
      if (savedWorkspaceId && response.data.length > 0) {
        const savedWorkspace = response.data.find((w: Workspace) => w._id === savedWorkspaceId);
        if (savedWorkspace) {
          setCurrentWorkspaceState(savedWorkspace);
        } else if (response.data.length > 0) {
          // Set first workspace as default if saved one doesn't exist
          setCurrentWorkspaceState(response.data[0]);
          localStorage.setItem('selectedWorkspaceId', response.data[0]._id);
        }
      } else if (response.data.length > 0) {
        // Set first workspace as default if none saved
        setCurrentWorkspaceState(response.data[0]);
        localStorage.setItem('selectedWorkspaceId', response.data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentWorkspace = (workspace: Workspace) => {
    console.log('Switching to workspace:', workspace.name);
    setCurrentWorkspaceState(workspace);
    localStorage.setItem('selectedWorkspaceId', workspace._id);
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
