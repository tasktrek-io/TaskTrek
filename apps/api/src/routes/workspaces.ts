import { Router, Response } from 'express';
import Workspace from '../models/Workspace';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

// Get all workspaces for the authenticated user
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.user!;
    const workspaces = await Workspace.find({
      $or: [{ owner: id }, { members: id }]
    })
    .populate('owner', 'name email')
    .populate('members', 'name email')
    .sort({ createdAt: -1 });
    
    res.json(workspaces);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific workspace
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const { id: workspaceId } = req.params;
    
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    })
    .populate('owner', 'name email')
    .populate('members', 'name email');
    
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    
    res.json(workspace);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new workspace
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.user!;
    const { name, description, color } = req.body;
    
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    
    const workspace = await Workspace.create({
      name: name.trim(),
      description: description?.trim(),
      color: color || '#ff6b35',
      owner: id,
      members: []
    });
    
    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members', 'name email');
    
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a workspace
router.patch('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const { id: workspaceId } = req.params;
    const { name, description, color } = req.body;
    
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      owner: userId
    });
    
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    
    if (name?.trim()) workspace.name = name.trim();
    if (description !== undefined) workspace.description = description?.trim();
    if (color) workspace.color = color;
    
    await workspace.save();
    
    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members', 'name email');
    
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add member to workspace
router.post('/:id/members', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const { id: workspaceId } = req.params;
    const { memberId } = req.body;
    
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      owner: userId
    });
    
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    
    if (!workspace.members.includes(memberId)) {
      workspace.members.push(memberId);
      await workspace.save();
    }
    
    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members', 'name email');
    
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove member from workspace
router.delete('/:id/members/:memberId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const { id: workspaceId, memberId } = req.params;
    
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      owner: userId
    });
    
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    
    workspace.members = workspace.members.filter(id => id.toString() !== memberId);
    await workspace.save();
    
    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members', 'name email');
    
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
