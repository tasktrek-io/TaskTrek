import { Router, Response } from 'express';
import Workspace from '../models/Workspace';
import PersonalSpace from '../models/PersonalSpace';
import Organization from '../models/Organization';
import Project from '../models/Project';
import Task from '../models/Task';
import Comment from '../models/Comment';
import TaskActivity from '../models/TaskActivity';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

// Get all workspaces for the authenticated user
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const { contextType, contextId } = req.query;
    
    let query: any = {
      $or: [{ owner: userId }, { members: userId }]
    };

    // If context parameters are provided, filter by context
    if (contextType && contextId) {
      // Validate the user has access to this context
      if (contextType === 'organization') {
        const hasAccess = await Organization.exists({ 
          _id: contextId, 
          'members.userId': userId 
        });
        
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }
      } else if (contextType === 'personal') {
        const personalSpace = await PersonalSpace.findById(contextId);
        if (!personalSpace || personalSpace.userId.toString() !== userId) {
          return res.status(403).json({ error: 'Access denied to this personal space' });
        }
      }

      // Add context filter to query
      query.contextType = contextType;
      query.contextId = contextId;
    }
    
    const workspaces = await Workspace.find(query)
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
    const { id: userId } = req.user!;
    const { name, description, color, contextType, contextId } = req.body;
    
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!contextType || !contextId) return res.status(400).json({ error: 'Context type and ID are required' });
    
    // Validate the user has access to this context
    if (contextType === 'organization') {
      const hasAccess = await Organization.exists({ 
        _id: contextId, 
        'members.userId': userId 
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this organization' });
      }
    } else if (contextType === 'personal') {
      const personalSpace = await PersonalSpace.findById(contextId);
      if (!personalSpace || personalSpace.userId.toString() !== userId) {
        return res.status(403).json({ error: 'Access denied to this personal space' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid context type' });
    }
    
    const workspace = await Workspace.create({
      name: name.trim(),
      description: description?.trim(),
      color: color || '#ff6b35',
      owner: userId,
      members: [],
      contextId,
      contextType
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
    
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    
    // Check if user has edit permissions
    let hasPermission = false;
    
    // Check if user is workspace owner
    if (workspace.owner.toString() === userId) {
      hasPermission = true;
    }
    // Check organization admin permissions if workspace is in organization context
    else if (workspace.contextType === 'organization') {
      const organization = await Organization.findOne({
        _id: workspace.contextId,
        'members.userId': userId,
        'members.role': { $in: ['owner', 'admin'] }
      });
      if (organization) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only admins and owners can edit workspaces' });
    }
    
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

// Delete workspace (admin/owner only)
router.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const { id: workspaceId } = req.params;
    
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    
    // Check if user has admin permissions
    let hasPermission = false;
    
    // Check if user is workspace owner
    if (workspace.owner.toString() === userId) {
      hasPermission = true;
    }
    // Check organization admin permissions if workspace is in organization context
    else if (workspace.contextType === 'organization') {
      const organization = await Organization.findOne({
        _id: workspace.contextId,
        'members.userId': userId,
        'members.role': { $in: ['owner', 'admin'] }
      });
      if (organization) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only admins and owners can delete workspaces' });
    }
    
    // Get all projects in this workspace
    const projects = await Project.find({ workspace: workspaceId });
    const projectIds = projects.map(project => project._id);
    
    // Get all tasks in these projects
    const tasks = await Task.find({ project: { $in: projectIds } });
    const taskIds = tasks.map(task => task._id);
    
    // Delete all comments associated with tasks
    await Comment.deleteMany({ task: { $in: taskIds } });
    
    // Delete all task activities
    await TaskActivity.deleteMany({ task: { $in: taskIds } });
    
    // Delete all tasks
    await Task.deleteMany({ project: { $in: projectIds } });
    
    // Delete all projects
    await Project.deleteMany({ workspace: workspaceId });
    
    // Delete the workspace
    await Workspace.findByIdAndDelete(workspaceId);
    
    res.json({ message: 'Workspace deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
