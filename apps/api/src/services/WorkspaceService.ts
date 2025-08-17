import Workspace from '../models/Workspace';
import Project from '../models/Project';
import Task from '../models/Task';
import { Types } from 'mongoose';
import { logger } from '../utils/logger';

export class WorkspaceService {
  /**
   * Automatically add user to workspace when they're assigned to a task or project
   */
  static async ensureUserInWorkspace(userId: string, projectId?: string, taskId?: string): Promise<void> {
    try {
      let workspaceId: string | null = null;

      // Get workspace ID from project or task
      if (projectId) {
        const project = await Project.findById(projectId).select('workspace');
        workspaceId = project?.workspace.toString() || null;
      } else if (taskId) {
        const task = await Task.findById(taskId).populate('project', 'workspace');
        workspaceId = (task?.project as any)?.workspace?.toString() || null;
      }

      if (!workspaceId) {
        logger.error('Could not determine workspace for user assignment', { userId, projectId, taskId });
        return;
      }

      // Check if user is already a member of the workspace
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        logger.error('Workspace not found', { workspaceId, userId });
        return;
      }

      const userObjectId = new Types.ObjectId(userId);
      
      // Check if user is already owner or member
      if (
        workspace.owner.toString() === userId ||
        workspace.members.some(memberId => memberId.toString() === userId)
      ) {
        // User is already in workspace
        return;
      }

      // Add user to workspace members
      workspace.members.push(userObjectId);
      await workspace.save();

      logger.info('Added user to workspace', { userId, workspaceId, action: 'auto_assignment' });
    } catch (error) {
      logger.error('Error ensuring user in workspace', { userId, projectId, taskId }, error as Error);
      // Don't throw error as this shouldn't break the main flow
    }
  }

  /**
   * Add user to workspace when they're added to a project
   */
  static async addUserToWorkspaceForProject(userId: string, projectId: string): Promise<void> {
    await this.ensureUserInWorkspace(userId, projectId);
  }

  /**
   * Add user to workspace when they're assigned to a task
   */
  static async addUserToWorkspaceForTask(userId: string, taskId: string): Promise<void> {
    await this.ensureUserInWorkspace(userId, undefined, taskId);
  }

  /**
   * Add multiple users to workspace for task assignment
   */
  static async addUsersToWorkspaceForTask(userIds: string[], taskId: string): Promise<void> {
    for (const userId of userIds) {
      await this.addUserToWorkspaceForTask(userId, taskId);
    }
  }

  /**
   * Add multiple users to workspace for project membership
   */
  static async addUsersToWorkspaceForProject(userIds: string[], projectId: string): Promise<void> {
    for (const userId of userIds) {
      await this.addUserToWorkspaceForProject(userId, projectId);
    }
  }
}

export default WorkspaceService;
