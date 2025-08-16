import Notification from '../models/Notification';
import { Types } from 'mongoose';

interface NotificationData {
  recipient: string;
  sender: string;
  type: 'task_assigned' | 'task_updated' | 'mentioned' | 'comment_added' | 'org_member_added' | 'org_role_updated' | 'project_member_added';
  title: string;
  message: string;
  relatedTask?: string;
  relatedComment?: string;
  relatedOrganization?: string;
  relatedProject?: string;
}

export class NotificationService {
  static async createNotification(data: NotificationData) {
    try {
      const notification = new Notification({
        recipient: new Types.ObjectId(data.recipient),
        sender: new Types.ObjectId(data.sender),
        type: data.type,
        title: data.title,
        message: data.message,
        relatedTask: data.relatedTask ? new Types.ObjectId(data.relatedTask) : undefined,
        relatedComment: data.relatedComment ? new Types.ObjectId(data.relatedComment) : undefined,
        relatedOrganization: data.relatedOrganization ? new Types.ObjectId(data.relatedOrganization) : undefined,
        relatedProject: data.relatedProject ? new Types.ObjectId(data.relatedProject) : undefined
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  static async notifyTaskAssignment(taskId: string, taskTitle: string, assigneeId: string, assignerId: string) {
    if (assigneeId === assignerId) return; // Don't notify self

    await this.createNotification({
      recipient: assigneeId,
      sender: assignerId,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `You have been assigned to task: ${taskTitle}`,
      relatedTask: taskId
    });
  }

  static async notifyTaskUpdate(taskId: string, taskTitle: string, assigneeIds: string[], updaterId: string) {
    for (const assigneeId of assigneeIds) {
      if (assigneeId === updaterId) continue; // Don't notify self

      await this.createNotification({
        recipient: assigneeId,
        sender: updaterId,
        type: 'task_updated',
        title: 'Task Updated',
        message: `Task "${taskTitle}" has been updated`,
        relatedTask: taskId
      });
    }
  }

  static async notifyMention(commentId: string, taskId: string, taskTitle: string, mentionedUserId: string, mentionerId: string) {
    if (mentionedUserId === mentionerId) return; // Don't notify self

    await this.createNotification({
      recipient: mentionedUserId,
      sender: mentionerId,
      type: 'mentioned',
      title: 'You were mentioned',
      message: `You were mentioned in a comment on task: ${taskTitle}`,
      relatedTask: taskId,
      relatedComment: commentId
    });
  }

  static async notifyNewComment(taskId: string, taskTitle: string, watcherIds: string[], commenterId: string) {
    for (const watcherId of watcherIds) {
      if (watcherId === commenterId) continue; // Don't notify self

      await this.createNotification({
        recipient: watcherId,
        sender: commenterId,
        type: 'comment_added',
        title: 'New Comment',
        message: `A new comment was added to task: ${taskTitle}`,
        relatedTask: taskId
      });
    }
  }

  static async notifyOrganizationMemberAdded(organizationId: string, organizationName: string, newMemberId: string, adderId: string, role: string) {
    if (newMemberId === adderId) return; // Don't notify self

    await this.createNotification({
      recipient: newMemberId,
      sender: adderId,
      type: 'org_member_added',
      title: 'Added to Organization',
      message: `You have been added to the organization "${organizationName}" as a ${role}`,
      relatedOrganization: organizationId
    });
  }

  static async notifyOrganizationRoleUpdated(organizationId: string, organizationName: string, memberId: string, updaterId: string, oldRole: string, newRole: string) {
    if (memberId === updaterId) return; // Don't notify self

    await this.createNotification({
      recipient: memberId,
      sender: updaterId,
      type: 'org_role_updated',
      title: 'Role Updated',
      message: `Your role in "${organizationName}" has been updated from ${oldRole} to ${newRole}`,
      relatedOrganization: organizationId
    });
  }

  static async notifyProjectMemberAdded(projectId: string, projectName: string, workspaceName: string, organizationName: string, newMemberId: string, adderId: string) {
    if (newMemberId === adderId) return; // Don't notify self

    const contextInfo = organizationName ? `in "${organizationName}"` : '';
    const message = `You have been added to the project "${projectName}" in workspace "${workspaceName}"${contextInfo}`;

    await this.createNotification({
      recipient: newMemberId,
      sender: adderId,
      type: 'project_member_added',
      title: 'Added to Project',
      message: message,
      relatedProject: projectId
    });
  }

  // Helper method to extract @mentions from text
  static extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }
}

export default NotificationService;
