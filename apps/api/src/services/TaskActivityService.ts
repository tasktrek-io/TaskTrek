import TaskActivity from '../models/TaskActivity';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

interface ActivityData {
  taskId: string;
  performedBy: string;
  action: 'created' | 'updated' | 'status_changed' | 'assigned' | 'unassigned' | 'priority_changed' | 'due_date_changed' | 'title_changed' | 'description_changed' | 'comment_added' | 'comment_reaction_added' | 'comment_reaction_removed' | 'task_deleted';
  field?: string;
  oldValue?: any;
  newValue?: any;
  details?: string;
  metadata?: any;
}

export class TaskActivityService {
  static async createActivity(data: ActivityData) {
    try {
      const activity = new TaskActivity({
        taskId: new Types.ObjectId(data.taskId),
        performedBy: new Types.ObjectId(data.performedBy),
        action: data.action,
        field: data.field,
        oldValue: data.oldValue,
        newValue: data.newValue,
        details: data.details,
        metadata: data.metadata
      });

      await activity.save();
      return activity;
    } catch (error) {
      logger.error('Error creating task activity', { taskId: data.taskId, userId: data.performedBy, action: data.action }, error as Error);
      throw error;
    }
  }

  static async getTaskActivities(taskId: string) {
    try {
      const activities = await TaskActivity.find({ taskId: taskId })
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 });

      return activities;
    } catch (error) {
      logger.error('Error fetching task activities', { taskId }, error as Error);
      throw error;
    }
  }

  static async trackTaskCreation(taskId: string, userId: string, taskData: any) {
    await this.createActivity({
      taskId: taskId,
      performedBy: userId,
      action: 'created',
      details: `Created task "${taskData.title}"`
    });
  }

  static async trackFieldChange(taskId: string, userId: string, field: string, oldValue: any, newValue: any) {
    const actionMap: Record<string, any> = {
      'status': 'status_changed',
      'priority': 'priority_changed',
      'dueDate': 'due_date_changed',
      'title': 'title_changed',
      'description': 'description_changed'
    };

    const action = actionMap[field] || 'updated';
    
    let details = '';
    switch (field) {
      case 'status':
        details = `Changed status from "${oldValue}" to "${newValue}"`;
        break;
      case 'priority':
        details = `Changed priority from "${oldValue}" to "${newValue}"`;
        break;
      case 'dueDate':
        details = oldValue 
          ? `Changed due date from ${new Date(oldValue).toLocaleDateString()} to ${new Date(newValue).toLocaleDateString()}`
          : `Set due date to ${new Date(newValue).toLocaleDateString()}`;
        break;
      case 'title':
        details = `Changed title from "${oldValue}" to "${newValue}"`;
        break;
      case 'description':
        details = oldValue 
          ? `Updated description`
          : `Added description`;
        break;
      default:
        details = `Updated ${field}`;
    }

    await this.createActivity({
      taskId: taskId,
      performedBy: userId,
      action,
      field,
      oldValue,
      newValue,
      details
    });
  }

  static async trackAssignment(taskId: string, userId: string, assigneeId: string, assigned: boolean) {
    await this.createActivity({
      taskId: taskId,
      performedBy: userId,
      action: assigned ? 'assigned' : 'unassigned',
      details: assigned ? `Assigned user` : `Unassigned user`,
      newValue: assigned ? assigneeId : null,
      oldValue: assigned ? null : assigneeId
    });
  }

  static async trackComment(taskId: string, userId: string) {
    await this.createActivity({
      taskId: taskId,
      performedBy: userId,
      action: 'comment_added',
      details: 'Added a comment'
    });
  }
}

export default TaskActivityService;
