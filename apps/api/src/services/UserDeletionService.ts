import User from '../models/User';
import Organization from '../models/Organization';
import Task from '../models/Task';
import Comment from '../models/Comment';
import Project from '../models/Project';
import TaskActivity from '../models/TaskActivity';
import PersonalSpace from '../models/PersonalSpace';
import Workspace from '../models/Workspace';
import Notification from '../models/Notification';
import { logger } from '../utils/logger';

export interface DeletionAssessment {
  canDelete: boolean;
  ownedOrganizations: any[];
  dataImpact: {
    activeTasks: number;
    comments: number;
    createdProjects: number;
    taskActivities: number;
    ownedWorkspaces: number;
  };
  blockingFactors: string[];
}

export class UserDeletionService {
  /**
   * Assess what needs to be done before a user can be deleted
   */
  static async assessDeletionImpact(userId: string): Promise<DeletionAssessment> {
    try {
      // Check owned organizations
      const ownedOrganizations = await Organization.find({ owner: userId }).lean();
      
      // Check data impact
      const [activeTasks, comments, createdProjects, taskActivities, ownedWorkspaces] = await Promise.all([
        Task.countDocuments({ assignedTo: userId }),
        Comment.countDocuments({ author: userId }),
        Project.countDocuments({ createdBy: userId }),
        TaskActivity.countDocuments({ user: userId }),
        Workspace.countDocuments({ createdBy: userId })
      ]);

      const blockingFactors: string[] = [];
      
      if (ownedOrganizations.length > 0) {
        blockingFactors.push(`Must transfer ownership of ${ownedOrganizations.length} organization(s)`);
      }

      return {
        canDelete: blockingFactors.length === 0,
        ownedOrganizations,
        dataImpact: {
          activeTasks,
          comments,
          createdProjects,
          taskActivities,
          ownedWorkspaces
        },
        blockingFactors
      };
    } catch (error) {
      logger.error('Error assessing deletion impact', { userId }, error as Error);
      throw new Error('Failed to assess deletion impact');
    }
  }

  /**
   * Get organizations owned by a user
   */
  static async getOwnedOrganizations(userId: string) {
    try {
      return await Organization.find({ owner: userId }).lean();
    } catch (error) {
      console.error('Error getting owned organizations:', error);
      throw new Error('Failed to get owned organizations');
    }
  }

  /**
   * Transfer ownership of an organization
   */
  static async transferOwnership(organizationId: string, fromUserId: string, toUserId: string) {
    try {
      // Verify the current user owns the organization
      const organization = await Organization.findOne({ 
        _id: organizationId, 
        owner: fromUserId 
      });

      if (!organization) {
        throw new Error('Organization not found or you are not the owner');
      }

      // Verify the new owner is a member of the organization
      const isMember = organization.members.some(
        member => member.userId.toString() === toUserId
      );

      if (!isMember) {
        throw new Error('New owner must be a member of the organization');
      }

      // Update ownership
      await Organization.findByIdAndUpdate(organizationId, {
        owner: toUserId,
        $set: {
          'members.$[member].role': 'owner'
        }
      }, {
        arrayFilters: [{ 'member.userId': toUserId }]
      });

      // Update the former owner's role to admin
      await Organization.findByIdAndUpdate(organizationId, {
        $set: {
          'members.$[member].role': 'admin'
        }
      }, {
        arrayFilters: [{ 'member.userId': fromUserId }]
      });

      console.log(`Ownership of organization ${organizationId} transferred from ${fromUserId} to ${toUserId}`);
    } catch (error) {
      console.error('Error transferring ownership:', error);
      throw error;
    }
  }

  /**
   * Soft delete user account (recommended approach)
   */
  static async softDeleteUser(userId: string) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Re-check ownership status (should be 0 after transfer)
      const currentOwnedOrgs = await Organization.find({ owner: userId }).lean();
      if (currentOwnedOrgs.length > 0) {
        throw new Error(`Cannot delete user: Must transfer ownership of ${currentOwnedOrgs.length} organization(s) first`);
      }

      const timestamp = Date.now();
      
      // Soft delete user - preserve original email for potential re-registration
      await User.findByIdAndUpdate(userId, {
        email: `deleted_${timestamp}_${user.email}`,
        name: 'Deleted User',
        passwordHash: null,
        phone: null,
        avatar: null,
        deleted: true,
        deletedAt: new Date(),
        originalEmail: user.email,
        emailVerified: false
      });

      // Anonymize user's data
      await this.anonymizeUserData(userId);

      // Remove user from all organizations (as member, not owner)
      await this.removeFromOrganizations(userId);

      // Delete personal data
      await this.deletePersonalData(userId);

      console.log(`User ${userId} soft deleted successfully`);
      return { success: true, message: 'Account deleted successfully' };
    } catch (error) {
      console.error('Error soft deleting user:', error);
      throw error;
    }
  }

  /**
   * Anonymize user's data while preserving work history
   */
  private static async anonymizeUserData(userId: string) {
    try {
      // Anonymize tasks assigned to user
      await Task.updateMany(
        { assignedTo: userId },
        { 
          $unset: { assignedTo: 1 },
          $set: { assignedToName: 'Former User' }
        }
      );

      // Anonymize comments
      await Comment.updateMany(
        { author: userId },
        { 
          $unset: { author: 1 },
          $set: { authorName: 'Former User' }
        }
      );

      // Anonymize task activities
      await TaskActivity.updateMany(
        { user: userId },
        { 
          $unset: { user: 1 },
          $set: { userName: 'Former User' }
        }
      );

      // For projects created by user, transfer to system user or mark as legacy
      await Project.updateMany(
        { createdBy: userId },
        { 
          $set: { 
            createdByName: 'Former User',
            isLegacy: true
          }
        }
      );

      // Handle notifications - add sender name for future reference
      await Notification.updateMany(
        { sender: userId },
        { 
          $set: { senderName: 'Former User' }
        }
      );

      console.log(`User data anonymized for user ${userId}`);
    } catch (error) {
      console.error('Error anonymizing user data:', error);
      throw error;
    }
  }

  /**
   * Remove user from all organizations
   */
  private static async removeFromOrganizations(userId: string) {
    try {
      await Organization.updateMany(
        { 'members.userId': userId },
        { $pull: { members: { userId: userId } } }
      );

      console.log(`User ${userId} removed from all organizations`);
    } catch (error) {
      console.error('Error removing user from organizations:', error);
      throw error;
    }
  }

  /**
   * Delete user's personal data
   */
  private static async deletePersonalData(userId: string) {
    try {
      // Delete personal workspace
      await PersonalSpace.deleteMany({ userId });

      // Delete personal workspaces
      await Workspace.deleteMany({ createdBy: userId });

      // Only delete notifications where user is RECIPIENT, not sender
      // This preserves notifications sent by this user to others
      await Notification.deleteMany({ recipient: userId });

      console.log(`Personal data deleted for user ${userId}`);
    } catch (error) {
      console.error('Error deleting personal data:', error);
      throw error;
    }
  }

  /**
   * Check if an email was previously used by a deleted account
   */
  static async checkEmailAvailability(email: string) {
    try {
      // Check if email is currently in use
      const activeUser = await User.findOne({ email, deleted: { $ne: true } });
      if (activeUser) {
        return { available: false, reason: 'Email already registered' };
      }

      // Check if email was used by deleted account
      const deletedUser = await User.findOne({ originalEmail: email, deleted: true });
      if (deletedUser) {
        return { 
          available: true, 
          reason: 'Email available for re-registration',
          previouslyDeleted: true 
        };
      }

      return { available: true, reason: 'Email available' };
    } catch (error) {
      console.error('Error checking email availability:', error);
      throw error;
    }
  }
}

export default UserDeletionService;
