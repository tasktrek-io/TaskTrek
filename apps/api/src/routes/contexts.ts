import express, { Response } from 'express';
import PersonalSpace from '../models/PersonalSpace';
import Organization from '../models/Organization';
import User from '../models/User';
import Workspace from '../models/Workspace';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import NotificationService from '../services/NotificationService';

const router = express.Router();

// Get user's personal space (create if doesn't exist)
router.get('/personal-space', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let personalSpace = await PersonalSpace.findOne({ userId });
    
    // Auto-create personal space if it doesn't exist
    if (!personalSpace) {
      personalSpace = new PersonalSpace({
        userId,
        settings: { 
          theme: 'light', 
          defaultView: 'list' 
        }
      });
      await personalSpace.save();
      
      // Update user with personal space reference
      await User.findByIdAndUpdate(userId, { 
        personalSpaceId: personalSpace._id 
      });

      // Create a default "My Tasks" workspace in personal space
      const defaultWorkspace = new Workspace({
        name: 'My Tasks',
        description: 'Your personal workspace for managing tasks',
        owner: userId,
        members: [userId],
        color: '#3b82f6', // Blue color
        contextId: personalSpace._id,
        contextType: 'personal'
      });
      await defaultWorkspace.save();
    }
    
    res.json(personalSpace);
  } catch (err) {
    console.error('Personal space error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's organizations
router.get('/organizations', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Find all orgs where user is a member
    const organizations = await Organization.find({ 
      'members.userId': userId 
    }).select('name slug logo ownerId members settings');
    
    res.json(organizations);
  } catch (err) {
    console.error('Organizations error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new organization
router.post('/organizations', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const userId = req.user!.id;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Auto-generate slug from name
    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Check if slug is already taken and add number if needed
    let slug = baseSlug;
    let counter = 1;
    while (await Organization.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const organization = new Organization({
      name: name.trim(),
      description: description?.trim(),
      slug,
      ownerId: userId,
      members: [{
        userId,
        role: 'owner',
        joinedAt: new Date()
      }]
    });

    await organization.save();

    // Create a default workspace for the organization
    const defaultWorkspace = new Workspace({
      name: 'General',
      description: 'Default workspace for the organization',
      owner: userId,
      members: [userId],
      color: '#10b981', // Green color
      contextId: organization._id,
      contextType: 'organization'
    });
    await defaultWorkspace.save();

    res.status(201).json(organization);
  } catch (err) {
    console.error('Create organization error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user's last active context
router.put('/context', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { type, id } = req.body;
    const userId = req.user!.id;

    if (!type || !id) {
      return res.status(400).json({ message: 'Type and id are required' });
    }

    if (!['personal', 'organization'].includes(type)) {
      return res.status(400).json({ message: 'Invalid context type' });
    }

    // Validate the user has access to this context
    if (type === 'organization') {
      const hasAccess = await Organization.exists({ 
        _id: id, 
        'members.userId': userId 
      });
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this organization' });
      }
    } else if (type === 'personal') {
      const personalSpace = await PersonalSpace.findById(id);
      if (!personalSpace || personalSpace.userId.toString() !== userId) {
        return res.status(403).json({ message: 'Access denied to this personal space' });
      }
    }

    await User.findByIdAndUpdate(userId, {
      lastActiveContext: { type, id }
    });

    res.json({ message: 'Context updated successfully' });
  } catch (err) {
    console.error('Update context error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all members of a specific context
router.get('/members', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { contextType, contextId } = req.query as { contextType?: string, contextId?: string };
    const userId = req.user!.id;
    
    if (!contextType || !contextId) {
      return res.status(400).json({ message: 'Context type and ID are required' });
    }

    if (!['personal', 'organization'].includes(contextType)) {
      return res.status(400).json({ message: 'Invalid context type' });
    }

    let userIds: string[] = [];
    let contextInfo: any = {};

    if (contextType === 'personal') {
      // For personal spaces, only return the current user
      const personalSpace = await PersonalSpace.findById(contextId);
      if (!personalSpace || personalSpace.userId.toString() !== userId) {
        return res.status(403).json({ message: 'Access denied to this personal space' });
      }
      userIds = [userId];
      contextInfo = { name: 'Personal Space', type: 'personal' };
    } else if (contextType === 'organization') {
      // For organizations, return all organization members with roles
      const organization = await Organization.findOne({ 
        _id: contextId,
        'members.userId': userId 
      });
      
      if (!organization) {
        return res.status(403).json({ message: 'Access denied to this organization' });
      }
      
      userIds = organization.members.map(member => member.userId.toString());
      contextInfo = { 
        name: organization.name, 
        type: 'organization',
        members: organization.members 
      };
    }

    // Get user details for all members
    const users = await User.find({
      _id: { $in: userIds }
    }).select('_id email name');

    // For organizations, include role information
    let membersWithRoles: any[];
    if (contextType === 'organization' && contextInfo.members) {
      membersWithRoles = users.map(user => {
        const userObj = user.toObject();
        const memberInfo = contextInfo.members.find((m: any) => m.userId.toString() === String(userObj._id));
        return {
          _id: userObj._id,
          email: userObj.email,
          name: userObj.name,
          role: memberInfo?.role || 'member',
          joinedAt: memberInfo?.joinedAt
        };
      });
    } else {
      membersWithRoles = users.map(user => {
        const userObj = user.toObject();
        return {
          _id: userObj._id,
          email: userObj.email,
          name: userObj.name,
          role: 'member',
          joinedAt: null
        };
      });
    }
    
    res.json({
      context: contextInfo,
      members: membersWithRoles
    });
  } catch (err) {
    console.error('Context members error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users within a specific context (for team member/assignee selection)
router.get('/users/search', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { q, contextType, contextId } = req.query as { q?: string, contextType?: string, contextId?: string };
    const userId = req.user!.id;
    
    if (!q?.trim()) {
      return res.json([]);
    }

    if (!contextType || !contextId) {
      return res.status(400).json({ message: 'Context type and ID are required' });
    }

    if (!['personal', 'organization'].includes(contextType)) {
      return res.status(400).json({ message: 'Invalid context type' });
    }

    let userIds: string[] = [];

    if (contextType === 'personal') {
      // For personal spaces, only return the current user
      const personalSpace = await PersonalSpace.findById(contextId);
      if (!personalSpace || personalSpace.userId.toString() !== userId) {
        return res.status(403).json({ message: 'Access denied to this personal space' });
      }
      userIds = [userId];
    } else if (contextType === 'organization') {
      // For organizations, return all organization members
      const organization = await Organization.findOne({ 
        _id: contextId,
        'members.userId': userId 
      });
      
      if (!organization) {
        return res.status(403).json({ message: 'Access denied to this organization' });
      }
      
      userIds = organization.members.map(member => member.userId.toString());
    }

    // Search users within the allowed user IDs
    const users = await User.find({
      _id: { $in: userIds },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    }).select('_id email name').limit(10);
    
    res.json(users);
  } catch (err) {
    console.error('Context user search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add member to organization
router.post('/organizations/:orgId/members', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const { email, role = 'member' } = req.body;
    const userId = req.user!.id;

    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "member" or "admin"' });
    }

    // Check if current user is owner or admin of the organization
    const organization = await Organization.findOne({
      _id: orgId,
      'members.userId': userId
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const currentUserMember = organization.members.find(m => m.userId.toString() === userId);
    if (!currentUserMember || !['owner', 'admin'].includes(currentUserMember.role)) {
      return res.status(403).json({ message: 'Only owners and admins can add members' });
    }

    // Find the user to be added
    const userToAdd = await User.findOne({ email: email.toLowerCase().trim() });
    if (!userToAdd) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    // Check if user is already a member
    const isAlreadyMember = organization.members.some(m => m.userId.toString() === String(userToAdd._id));
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of this organization' });
    }

    // Add the user to organization
    organization.members.push({
      userId: String(userToAdd._id),
      role,
      joinedAt: new Date()
    });

    await organization.save();

    // Send notification to the new member
    try {
      await NotificationService.notifyOrganizationMemberAdded(
        orgId,
        organization.name,
        String(userToAdd._id),
        userId,
        role
      );
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the operation if notification fails
    }

    // Return the updated member list
    const updatedOrg = await Organization.findById(orgId)
      .populate('members.userId', '_id email name');

    res.status(201).json({
      message: 'Member added successfully',
      organization: updatedOrg
    });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove member from organization
router.delete('/organizations/:orgId/members/:memberId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { orgId, memberId } = req.params;
    const userId = req.user!.id;

    const organization = await Organization.findOne({
      _id: orgId,
      'members.userId': userId
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const currentUserMember = organization.members.find(m => m.userId.toString() === userId);
    if (!currentUserMember || !['owner', 'admin'].includes(currentUserMember.role)) {
      return res.status(403).json({ message: 'Only owners and admins can remove members' });
    }

    // Don't allow removing the owner
    const memberToRemove = organization.members.find(m => m.userId.toString() === memberId);
    if (!memberToRemove) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (memberToRemove.role === 'owner') {
      return res.status(400).json({ message: 'Cannot remove the organization owner' });
    }

    // Remove the member
    organization.members = organization.members.filter(m => m.userId.toString() !== memberId);
    await organization.save();

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update member role
router.patch('/organizations/:orgId/members/:memberId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { orgId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user!.id;

    if (!role || !['member', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "member" or "admin"' });
    }

    const organization = await Organization.findOne({
      _id: orgId,
      'members.userId': userId
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const currentUserMember = organization.members.find(m => m.userId.toString() === userId);
    if (!currentUserMember || currentUserMember.role !== 'owner') {
      return res.status(403).json({ message: 'Only the owner can change member roles' });
    }

    const memberToUpdate = organization.members.find(m => m.userId.toString() === memberId);
    if (!memberToUpdate) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (memberToUpdate.role === 'owner') {
      return res.status(400).json({ message: 'Cannot change the owner role' });
    }

    // Store old role for notification
    const oldRole = memberToUpdate.role;

    // Update the role
    memberToUpdate.role = role;
    await organization.save();

    // Send notification to the member about role change
    try {
      await NotificationService.notifyOrganizationRoleUpdated(
        orgId,
        organization.name,
        memberId,
        userId,
        oldRole,
        role
      );
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the operation if notification fails
    }

    res.json({ message: 'Member role updated successfully' });
  } catch (err) {
    console.error('Update member role error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave organization (self-removal)
router.delete('/organizations/:orgId/leave', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const userId = req.user!.id;

    const organization = await Organization.findOne({
      _id: orgId,
      'members.userId': userId
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found or you are not a member' });
    }

    const currentUserMember = organization.members.find(m => m.userId.toString() === userId);
    if (!currentUserMember) {
      return res.status(404).json({ message: 'You are not a member of this organization' });
    }

    // Owners cannot leave their own organization
    if (currentUserMember.role === 'owner') {
      return res.status(400).json({ message: 'Organization owners cannot leave. You must transfer ownership or delete the organization.' });
    }

    // Remove the user from the organization
    organization.members = organization.members.filter(m => m.userId.toString() !== userId);
    await organization.save();

    res.json({ message: 'Successfully left the organization' });
  } catch (err) {
    console.error('Leave organization error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
