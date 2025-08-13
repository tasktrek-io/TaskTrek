import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import Project from '../models/Project';
import User from '../models/User';
import { Types } from 'mongoose';

const router = Router();

// Create project
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { name, description, members } = req.body as { name: string; description?: string; members?: string[] };
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const ownerId = req.user!.id;
    const project = await Project.create({ name, description, owner: ownerId, members: members || [] });
    return res.status(201).json(project);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List my projects (owner or member)
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const projects = await Project.find({ $or: [{ owner: userId }, { members: userId }] }).sort({ createdAt: -1 });
  return res.json(projects);
});

// Get project details if member or owner
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const userId = req.user!.id;
  const project = await Project.findOne({ _id: id, $or: [{ owner: userId }, { members: userId }] })
    .populate('owner', '_id email name')
    .populate('members', '_id email name');
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json(project);
});

// Add member (owner only)
router.post('/:id/members', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const { memberId } = req.body as { memberId: string };
  const userId = req.user!.id;

  const project = await Project.findById(id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (project.owner.toString() !== userId) return res.status(403).json({ error: 'Forbidden' });
  const member = await User.findById(memberId);
  if (!member) return res.status(404).json({ error: 'User not found' });

  if (!project.members.some(m => m.toString() === memberId)) {
    project.members.push(new Types.ObjectId(memberId) as any);
    await project.save();
  }
  res.json({ ok: true });
});

export default router;
