import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import Task from '../models/Task';
import TaskActivity from '../models/TaskActivity';
import Comment from '../models/Comment';
import User from '../models/User';
import Project from '../models/Project';
import NotificationService from '../services/NotificationService';
import TaskActivityService from '../services/TaskActivityService';
import WorkspaceService from '../services/WorkspaceService';
import { Types, Schema } from 'mongoose';

const router = Router();

// Create task under project
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { 
      project, 
      title, 
      description, 
      assignees, 
      priority, 
      dueDate,
      status 
    } = req.body as { 
      project: string; 
      title: string; 
      description?: string; 
      assignees?: string[];
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      dueDate?: string;
      status?: 'todo' | 'in_progress' | 'done';
    };
    
    if (!project || !title) return res.status(400).json({ error: 'Project and title are required' });
    
    const createdBy = req.user!.id;
    const task = await Task.create({ 
      project, 
      title, 
      description, 
      assignees: assignees || [],
      priority: priority || 'medium',
      status: status || 'todo',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      watchers: [createdBy], // Creator watches by default
      createdBy 
    });

    // Create notifications for assignees
    if (assignees && assignees.length > 0) {
      for (const assigneeId of assignees) {
        await NotificationService.notifyTaskAssignment((task._id as Types.ObjectId).toString(), title, assigneeId, createdBy);
        
        // Add assignee to workspace automatically
        await WorkspaceService.addUserToWorkspaceForTask(assigneeId, (task._id as Types.ObjectId).toString());
      }
    }

    // Track task creation activity
    await TaskActivityService.trackTaskCreation((task._id as Types.ObjectId).toString(), createdBy, { title });

    const populated = await Task.findById(task._id)
      .populate('project', 'name workspace')
      .populate('assignees', 'name email')
      .populate('watchers', 'name email')
      .populate('createdBy', 'name email')
      .populate('documents', 'filename originalName mimeType size category uploadedAt uploadedBy');    return res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task with comprehensive change tracking
router.patch('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const updateData = req.body;

    // Get current task for comparison
    const currentTask = await Task.findById(id);
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Track changes for each field
    const fieldsToTrack = ['title', 'description', 'status', 'priority', 'dueDate', 'assignees'];
    const changes: any[] = [];

    for (const field of fieldsToTrack) {
      if (updateData[field] !== undefined) {
        const oldValue = currentTask[field as keyof typeof currentTask];
        const newValue = updateData[field];
        
        // Special handling for arrays and dates
        let hasChanged = false;
        if (field === 'assignees') {
          const oldAssignees = (oldValue as any[])?.map(a => a.toString()).sort() || [];
          const newAssignees = (newValue as string[])?.sort() || [];
          hasChanged = JSON.stringify(oldAssignees) !== JSON.stringify(newAssignees);
        } else if (field === 'dueDate') {
          const oldDate = oldValue ? new Date(oldValue as any).getTime() : null;
          const newDate = newValue ? new Date(newValue).getTime() : null;
          hasChanged = oldDate !== newDate;
        } else {
          hasChanged = oldValue !== newValue;
        }

        if (hasChanged) {
          changes.push({ field, oldValue, newValue });
        }
      }
    }

    // Update the task
    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    ).populate('assignees', 'name email')
     .populate('watchers', 'name email')
     .populate('createdBy', 'name email');

    // Track activities for each change
    for (const change of changes) {
      await TaskActivityService.trackFieldChange(
        id,
        userId,
        change.field,
        change.oldValue,
        change.newValue
      );

      // Send notifications for specific changes
      if (change.field === 'status' || change.field === 'priority') {
        const assigneeIds = updatedTask?.assignees.map((a: any) => a._id.toString()) || [];
        await NotificationService.notifyTaskUpdate(
          id,
          updatedTask?.title || '',
          assigneeIds,
          userId
        );
      }

      // Handle assignee changes
      if (change.field === 'assignees') {
        const oldAssignees = change.oldValue || [];
        const newAssignees = change.newValue || [];
        
        // Notify newly assigned users and add them to workspace
        const newlyAssigned = newAssignees.filter((a: string) => !oldAssignees.includes(a));
        for (const assigneeId of newlyAssigned) {
          await NotificationService.notifyTaskAssignment(id, updatedTask?.title || '', assigneeId, userId);
          await TaskActivityService.trackAssignment(id, userId, assigneeId, true);
          
          // Add user to workspace automatically
          await WorkspaceService.addUserToWorkspaceForTask(assigneeId, id);
        }

        // Track unassigned users
        const unassigned = oldAssignees.filter((a: string) => !newAssignees.includes(a));
        for (const assigneeId of unassigned) {
          await TaskActivityService.trackAssignment(id, userId, assigneeId, false);
        }
      }
    }

    res.json(updatedTask);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assigned tasks for current user
router.get('/assigned', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const tasks = await Task.find({ assignees: userId })
      .populate('project', 'name')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1, createdAt: -1 });
    
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single task with details
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = await Task.findById(id)
      .populate('project', 'name workspace')
      .populate('assignees', 'name email')
      .populate('watchers', 'name email')
      .populate('createdBy', 'name email')
      .populate('documents', 'filename originalName mimeType size category uploadedAt uploadedBy');
    
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    // Get comments for this task
    const comments = await Comment.find({ task: id })
      .populate('author', 'name email')
      .populate('reactions.users', 'name email')
      .sort({ createdAt: 1 });
    
    res.json({ task, comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add/remove watcher
router.post('/:id/watchers', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, action } = req.body as { userId?: string; action: 'add' | 'remove' };
    const watcherId = userId || req.user!.id;
    
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    if (action === 'add') {
      if (!task.watchers.includes(new Types.ObjectId(watcherId) as any)) {
        task.watchers.push(new Types.ObjectId(watcherId) as any);
      }
    } else {
      task.watchers = task.watchers.filter(w => w.toString() !== watcherId);
    }
    
    await task.save();
    
    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email')
      .populate('watchers', 'name email')
      .populate('createdBy', 'name email');
    
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task activities
router.get('/:id/activities', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const activities = await TaskActivity.find({ taskId: id })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string));

    const total = await TaskActivity.countDocuments({ taskId: id });

    res.json({
      activities,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / parseInt(limit as string))
    });
  } catch (err) {
    console.error('Error fetching task activities:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to task
router.post('/:id/comments', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body as { content: string };
    const authorId = req.user!.id;
    
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
    
    const task = await Task.findById(id).populate('watchers', '_id');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const comment = await Comment.create({
      task: id,
      author: authorId,
      content: content.trim()
    });

    // Extract @mentions from comment content
    const mentions = NotificationService.extractMentions(content);
    
    // Find mentioned users by email or name
    if (mentions.length > 0) {
      const mentionedUsers = await User.find({
        $or: [
          { email: { $in: mentions } },
          { name: { $in: mentions } }
        ]
      });

      // Send mention notifications
      for (const mentionedUser of mentionedUsers) {
        await NotificationService.notifyMention(
          (comment._id as Types.ObjectId).toString(),
          id,
          task.title,
          (mentionedUser._id as Types.ObjectId).toString(),
          authorId
        );
      }
    }

    // Notify watchers about new comment
    const watcherIds = task.watchers.map(w => (w as any)._id.toString());
    await NotificationService.notifyNewComment(
      id,
      task.title,
      watcherIds,
      authorId
    );

    // Track comment activity
    await TaskActivityService.createActivity({
      taskId: id,
      performedBy: authorId,
      action: 'comment_added',
      details: 'Added a comment',
      metadata: { commentId: comment._id }
    });
    
    const populated = await Comment.findById(comment._id)
      .populate('author', 'name email')
      .populate('reactions.users', 'name email');
    
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks by workspace
router.get('/workspace/:workspaceId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    
    // Get all projects in workspace
    const projects = await Project.find({ workspace: workspaceId }, '_id');
    const projectIds = projects.map(p => p._id);
    
    if (projectIds.length === 0) {
      return res.json([]);
    }
    
    const tasks = await Task.find({ project: { $in: projectIds } })
      .populate('project', 'name')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1, createdAt: -1 });
    
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks assigned to current user
// List tasks for a project
router.get('/project/:projectId', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { projectId } = req.params;
  const tasks = await Task.find({ project: projectId })
    .sort({ createdAt: -1 })
    .populate('assignees', '_id email name')
    .populate('watchers', '_id email name')
    .populate('createdBy', '_id email name');
  return res.json(tasks);
});

// Delete task
router.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Find the task first to check permissions
    const task = await Task.findById(id).populate('project', 'owner members');
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user has permission to delete (task creator, project owner, or project member)
    const project = task.project as any;
    const isTaskCreator = task.createdBy.toString() === userId;
    const isProjectOwner = project.owner.toString() === userId;
    const isProjectMember = project.members.some((member: any) => member.toString() === userId);

    if (!isTaskCreator && !isProjectOwner && !isProjectMember) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Delete all related data
    await Comment.deleteMany({ task: id });
    await TaskActivity.deleteMany({ taskId: id });
    
    // Delete the task
    await Task.findByIdAndDelete(id);

    // Track deletion activity in project level if needed
    await TaskActivityService.createActivity({
      taskId: id,
      performedBy: userId,
      action: 'task_deleted',
      details: `Deleted task: ${task.title}`,
      metadata: { taskTitle: task.title, projectId: task.project }
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add emoji reaction to comment
router.post('/:taskId/comments/:commentId/reactions', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { taskId, commentId } = req.params;
    const { emoji } = req.body;
    const userId = req.user!.id;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Remove user's existing reaction first (one reaction per user)
    comment.reactions = comment.reactions.filter(reaction => 
      !reaction.users.some(u => u.toString() === userId)
    );

    // Check if this emoji already exists
    const existingReaction = comment.reactions.find(r => r.emoji === emoji);
    let isRemoving = false;
    
    if (existingReaction) {
      // Add user to existing reaction
      existingReaction.users.push(userId as any);
      existingReaction.count = existingReaction.users.length;
    } else {
      // Create new reaction
      comment.reactions.push({
        emoji,
        users: [userId as any],
        count: 1
      });
    }

    await comment.save();

    // Track activity
    await TaskActivityService.createActivity({
      taskId,
      performedBy: userId,
      action: 'comment_reaction_added',
      details: `Reacted with ${emoji} to comment`,
      metadata: { commentId, emoji }
    });

    // Populate the author and reaction users before returning
    await comment.populate('author', 'name email');
    await comment.populate('reactions.users', 'name email');
    res.json(comment);
  } catch (err) {
    console.error('Error managing comment reaction:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Edit comment
router.patch('/:taskId/comments/:commentId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { taskId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const comment = await Comment.findById(commentId).populate('author', 'name email');
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user is the comment author
    if ((comment.author as any)._id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the comment author can edit this comment' });
    }

    // Update the comment
    comment.content = content.trim();
    await comment.save();

    // Track activity
    await TaskActivityService.createActivity({
      taskId,
      performedBy: userId,
      action: 'comment_updated',
      details: 'Updated a comment',
      metadata: { commentId }
    });

    res.json(comment);
  } catch (err) {
    console.error('Error editing comment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete comment
router.delete('/:taskId/comments/:commentId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { taskId, commentId } = req.params;
    const userId = req.user!.id;

    const comment = await Comment.findById(commentId).populate('author', 'name email');
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user is the comment author
    if ((comment.author as any)._id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the comment author can delete this comment' });
    }

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);

    // Track activity
    await TaskActivityService.createActivity({
      taskId,
      performedBy: userId,
      action: 'comment_deleted',
      details: 'Deleted a comment',
      metadata: { commentId }
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
