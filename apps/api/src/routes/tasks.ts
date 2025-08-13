import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import Task from '../models/Task';

const router = Router();

// Create task under project
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { project, title, description, assignee } = req.body as { project: string; title: string; description?: string; assignee?: string };
    if (!project || !title) return res.status(400).json({ error: 'Missing fields' });
    const createdBy = req.user!.id;
    const task = await Task.create({ project, title, description, assignee, createdBy });
    return res.status(201).json(task);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task status or assignee
router.patch('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status, assignee, title, description } = req.body as { status?: 'todo' | 'in_progress' | 'done'; assignee?: string; title?: string; description?: string };
    const update: any = {};
    if (status) update.status = status;
    if (assignee !== undefined) update.assignee = assignee || undefined;
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;

    const task = await Task.findByIdAndUpdate(id, update, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json(task);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List tasks for a project
router.get('/project/:projectId', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const tasks = await Task.find({ project: projectId }).sort({ createdAt: -1 }).populate('assignee', '_id email name');
  return res.json(tasks);
});

export default router;
