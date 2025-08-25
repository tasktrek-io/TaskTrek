import { api } from './api';

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Workspace {
  _id: string;
  name: string;
  owner: User;
  contextType: 'personal' | 'organization';
  contextId: string;
}

interface Project {
  _id: string;
  name: string;
  owner: User;
  workspace:
    | Workspace
    | string
    | {
        _id: string;
        name: string;
        contextType: 'personal' | 'organization';
        contextId: string;
      };
}

interface OrganizationMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
}

interface Organization {
  _id: string;
  name: string;
  ownerId: string;
  members: OrganizationMember[];
}

/**
 * Check if current user can delete a project
 */
export async function canDeleteProject(project: Project, currentUserId: string): Promise<boolean> {
  try {
    // Project owner can always delete
    if (project.owner._id === currentUserId) {
      return true;
    }

    // Get workspace details if not already populated
    let workspaceDetails: {
      contextType: 'personal' | 'organization';
      contextId: string;
      owner?: User;
    };

    if (typeof project.workspace === 'string') {
      const response = await api.get(`/workspaces/${project.workspace}`);
      workspaceDetails = response.data;
    } else if ('owner' in project.workspace) {
      workspaceDetails = project.workspace;
    } else {
      // It's the simplified workspace object from project detail
      workspaceDetails = {
        contextType: project.workspace.contextType,
        contextId: project.workspace.contextId,
      };

      // Get the full workspace details to check owner
      const response = await api.get(`/workspaces/${project.workspace._id}`);
      workspaceDetails.owner = response.data.owner;
    }

    // Workspace owner can delete projects in their workspace
    if (workspaceDetails.owner && workspaceDetails.owner._id === currentUserId) {
      return true;
    }

    // If workspace is in organization context, check organization admin permissions
    if (workspaceDetails.contextType === 'organization') {
      return await isOrganizationAdmin(workspaceDetails.contextId, currentUserId);
    }

    return false;
  } catch (error) {
    console.error('Error checking project delete permissions:', error);
    return false;
  }
}

/**
 * Check if current user can delete a workspace
 */
export async function canDeleteWorkspace(
  workspace: Workspace,
  currentUserId: string
): Promise<boolean> {
  try {
    // Workspace owner can always delete
    if (workspace.owner._id === currentUserId) {
      return true;
    }

    // If workspace is in organization context, check organization admin permissions
    if (workspace.contextType === 'organization') {
      return await isOrganizationAdmin(workspace.contextId, currentUserId);
    }

    return false;
  } catch (error) {
    console.error('Error checking workspace delete permissions:', error);
    return false;
  }
}

/**
 * Check if current user can edit a workspace
 */
export async function canEditWorkspace(
  workspace: Workspace,
  currentUserId: string
): Promise<boolean> {
  try {
    // Workspace owner can always edit
    if (workspace.owner._id === currentUserId) {
      return true;
    }

    // If workspace is in organization context, check organization admin permissions
    if (workspace.contextType === 'organization') {
      return await isOrganizationAdmin(workspace.contextId, currentUserId);
    }

    return false;
  } catch (error) {
    console.error('Error checking workspace edit permissions:', error);
    return false;
  }
}

/**
 * Check if user is admin or owner of an organization
 */
export async function isOrganizationAdmin(
  organizationId: string,
  userId: string
): Promise<boolean> {
  try {
    const response = await api.get('/contexts/organizations');
    const organizations: Organization[] = response.data;

    const organization = organizations.find(org => org._id === organizationId);
    if (!organization) {
      return false;
    }

    // Check if user is organization owner
    if (organization.ownerId === userId) {
      return true;
    }

    // Check if user is organization admin
    const member = organization.members.find(m => m.userId === userId);
    return member?.role === 'admin' || member?.role === 'owner';
  } catch (error) {
    console.error('Error checking organization admin status:', error);
    return false;
  }
}

/**
 * Get current user's role in an organization
 */
export async function getUserOrganizationRole(
  organizationId: string,
  userId: string
): Promise<'owner' | 'admin' | 'member' | null> {
  try {
    const response = await api.get('/contexts/organizations');
    const organizations: Organization[] = response.data;

    const organization = organizations.find(org => org._id === organizationId);
    if (!organization) {
      return null;
    }

    // Check if user is organization owner
    if (organization.ownerId === userId) {
      return 'owner';
    }

    // Get user's role from members array
    const member = organization.members.find(m => m.userId === userId);
    return member?.role || null;
  } catch (error) {
    console.error('Error getting user organization role:', error);
    return null;
  }
}
