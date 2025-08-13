import Notification from '../models/Notification';
import { Types } from 'mongoose';

interface NotificationData {
  recipient: string;
  sender: string;
  type: 'task_assigned' | 'task_updated' | 'mentioned' | 'comment_added';
  title: string;
  message: string;
  relatedTask?: string;
  relatedComment?: string;
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
        relatedComment: data.relatedComment ? new Types.ObjectId(data.relatedComment) : undefined
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
