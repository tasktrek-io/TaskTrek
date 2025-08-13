import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import Task from '../models/Task';
import Comment from '../models/Comment';
import { Types } from 'mongoose';

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
      dueDate 
    } = req.body as { 
      project: string; 
      title: string; 
      description?: string; 
      assignees?: string[];
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      dueDate?: string;
    };
    
    if (!project || !title) return res.status(400).json({ error: 'Project and title are required' });
    
    const createdBy = req.user!.id;
    const task = await Task.create({ 
      project, 
      title, 
      description, 
      assignees: assignees || [],
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      watchers: [createdBy], // Creator watches by default
      createdBy 
    });
    
    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email')
      .populate('watchers', 'name email')
      .populate('createdBy', 'name email');
    
    return res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
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
      .populate('createdBy', 'name email');
    
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    // Get comments for this task
    const comments = await Comment.find({ task: id })
      .populate('author', 'name email')
      .sort({ createdAt: 1 });
    
    res.json({ task, comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.patch('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      assignees, 
      title, 
      description, 
      priority, 
      dueDate 
    } = req.body as { 
      status?: 'todo' | 'in_progress' | 'done'; 
      assignees?: string[]; 
      title?: string; 
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      dueDate?: string;
    };
    
    const update: any = {};
    if (status) update.status = status;
    if (assignees !== undefined) update.assignees = assignees;
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (priority) update.priority = priority;
    if (dueDate !== undefined) update.dueDate = dueDate ? new Date(dueDate) : undefined;

    const task = await Task.findByIdAndUpdate(id, update, { new: true })
      .populate('assignees', 'name email')
      .populate('watchers', 'name email')
      .populate('createdBy', 'name email');
    
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json(task);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
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

// Add comment to task
router.post('/:id/comments', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body as { content: string };
    const authorId = req.user!.id;
    
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
    
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const comment = await Comment.create({
      task: id,
      author: authorId,
      content: content.trim()
    });
    
    const populated = await Comment.findById(comment._id)
      .populate('author', 'name email');
    
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks assigned to current user
router.get('/assigned/me', requireAuth, async (req: AuthedRequest, res: Response) => {
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

export default router;
