import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import Project from '../models/Project';
import Workspace from '../models/Workspace';
import User from '../models/User';
import WorkspaceService from '../services/WorkspaceService';
import { Types } from 'mongoose';

const router = Router();

// Create project
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { workspace, name, description, status, startDate, endDate, tags, members } = req.body as { 
      workspace: string; 
      name: string; 
      description?: string; 
      status?: string;
      startDate?: string;
      endDate?: string;
      tags?: string[];
      members?: string[] 
    };
    
    if (!workspace || !name) {
      return res.status(400).json({ error: 'Workspace and name are required' });
    }
    
    const ownerId = req.user!.id;
    
    // Verify user has access to workspace
    const workspaceDoc = await Workspace.findOne({
      _id: workspace,
      $or: [{ owner: ownerId }, { members: ownerId }]
    });
    
    if (!workspaceDoc) {
      return res.status(403).json({ error: 'Access denied to workspace' });
    }
    
    const project = await Project.create({ 
      workspace,
      name, 
      description, 
      status: status || 'planning',
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      tags: tags || [],
      owner: ownerId, 
      members: members || [] 
    });
    
    // Add all initial members to workspace
    if (members && members.length > 0) {
      await WorkspaceService.addUsersToWorkspaceForProject(members, (project._id as Types.ObjectId).toString());
    }
    
    const populated = await Project.findById(project._id)
      .populate('workspace', 'name')
      .populate('owner', 'name email')
      .populate('members', 'name email');
    
    return res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List projects by workspace
router.get('/workspace/:workspaceId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.id;
    
    // Verify user has access to workspace
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });
    
    if (!workspace) {
      return res.status(403).json({ error: 'Access denied to workspace' });
    }
    
    const projects = await Project.find({ workspace: workspaceId })
      .populate('workspace', 'name')
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .sort({ createdAt: -1 });
    
    return res.json(projects);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List my projects (owner or member) - kept for backward compatibility
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const projects = await Project.find({ $or: [{ owner: userId }, { members: userId }] })
    .populate('workspace', 'name')
    .populate('owner', 'name email')
    .populate('members', 'name email')
    .sort({ createdAt: -1 });
  return res.json(projects);
});

// Get project details if member or owner
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const userId = req.user!.id;
  const project = await Project.findOne({ _id: id, $or: [{ owner: userId }, { members: userId }] })
    .populate('workspace', 'name')
    .populate('owner', '_id email name')
    .populate('members', '_id email name');
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json(project);
});

// Update project
router.patch('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, description, status, startDate, endDate, tags } = req.body;
    
    const project = await Project.findOne({ _id: id, owner: userId });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (status) project.status = status;
    if (startDate !== undefined) project.startDate = startDate ? new Date(startDate) : undefined;
    if (endDate !== undefined) project.endDate = endDate ? new Date(endDate) : undefined;
    if (tags) project.tags = tags;
    
    await project.save();
    
    const populated = await Project.findById(project._id)
      .populate('workspace', 'name')
      .populate('owner', 'name email')
      .populate('members', 'name email');
    
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
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

  // Check if user is already owner
  if (project.owner.toString() === memberId) {
    return res.status(400).json({ error: 'User is already the project owner' });
  }

  // Check if user is already a member
  if (!project.members.some(m => m.toString() === memberId)) {
    project.members.push(new Types.ObjectId(memberId) as any);
    await project.save();
    
    // Add user to workspace automatically
    await WorkspaceService.addUserToWorkspaceForProject(memberId, id);
  } else {
    return res.status(400).json({ error: 'User is already a member of this project' });
  }
  res.json({ ok: true });
});

export default router;
