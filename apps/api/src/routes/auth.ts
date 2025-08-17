import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import Organization from '../models/Organization';
import EmailVerification from '../models/EmailVerification';
import EmailService from '../services/EmailService';
import UserDeletionService from '../services/UserDeletionService';
import { PasswordResetService } from '../services/PasswordResetService';
import { logger } from '../utils/logger';

// Create email service instance after env is loaded
const emailService = new EmailService();
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

router.post('/register', async (req: Request, res: Response) => {
  try {
    let { email, name, password } = req.body as { email?: string; name?: string; password?: string };
    email = (email || '').trim().toLowerCase();
    name = (name || '').trim();
    if (!email || !name || !password) return res.status(400).json({ error: 'Missing fields' });

    // Check if email is available for registration
    const emailCheck = await UserDeletionService.checkEmailAvailability(email);
    if (!emailCheck.available && !emailCheck.previouslyDeleted) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      email, 
      name, 
      passwordHash: hash, 
      emailVerified: false 
    });

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save verification token
    await EmailVerification.create({
      userId: user._id,
      token: verificationToken,
      expiresAt
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      logger.error('Failed to send verification email', { email, userId: user.id }, emailError as Error);
      // Continue with registration even if email fails
    }

    return res.status(201).json({ 
      message: 'Registration successful. Please check your email to verify your account.',
      user: { id: user.id, email, name, emailVerified: false },
      requiresVerification: true
    });
  } catch (err) {
    logger.error('Registration error', {}, err as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    let { email, password } = req.body as { email?: string; password?: string };
    email = (email || '').trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({ 
        error: 'Please verify your email address before logging in',
        requiresVerification: true,
        email: user.email
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    
    // Set cookie with proper cross-domain settings
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, { 
      httpOnly: true, 
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      // Remove domain restriction to allow subdomains to work
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    return res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (err) {
    logger.error('Login error', {}, err as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ ok: true, message: 'Logged out successfully' });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.user!;
  const user = await User.findById(id).select('_id email name phone avatar lastActiveContext createdAt');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ 
    user: { 
      _id: user._id, 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      phone: user.phone,
      avatar: user.avatar,
      lastActiveContext: user.lastActiveContext,
      createdAt: user.createdAt
    } 
  });
});

router.patch('/profile', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.user!;
    const { name, phone, avatar } = req.body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        phone: phone ? phone.trim() : undefined,
        avatar: avatar ? avatar.trim() : undefined
      },
      { new: true, runValidators: true }
    ).select('_id email name phone avatar lastActiveContext createdAt');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      user: { 
        _id: updatedUser._id, 
        id: updatedUser.id, 
        email: updatedUser.email, 
        name: updatedUser.name, 
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
        lastActiveContext: updatedUser.lastActiveContext,
        createdAt: updatedUser.createdAt
      } 
    });
  } catch (err) {
    logger.error('Error updating profile', { userId: req.user?.id }, err as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email with token
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find the verification record
    const verification = await EmailVerification.findOne({ token });
    if (!verification) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    if (verification.expiresAt < new Date()) {
      await EmailVerification.deleteOne({ _id: verification._id });
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Find the user and update verification status
    const user = await User.findById(verification.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      // Clean up the verification token
      await EmailVerification.deleteOne({ _id: verification._id });
      
      // Generate JWT token for login since email is already verified
      const authToken = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      
      // Set cookie
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', authToken, { 
        httpOnly: true, 
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return res.json({ 
        message: 'Email verification completed',
        user: { id: user.id, email: user.email, name: user.name, emailVerified: true },
        token: authToken,
        alreadyVerified: true
      });
    }

    // Update user verification status atomically to prevent race conditions
    const updateResult = await User.findOneAndUpdate(
      { _id: verification.userId, emailVerified: false },
      { emailVerified: true },
      { new: true }
    );

    if (!updateResult) {
      // User was already verified by another request - treat as success
      await EmailVerification.deleteOne({ _id: verification._id });
      
      // Generate JWT token for login since email verification is complete
      const authToken = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      
      // Set cookie
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', authToken, { 
        httpOnly: true, 
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return res.json({ 
        message: 'Email verification completed',
        user: { id: user.id, email: user.email, name: user.name, emailVerified: true },
        token: authToken,
        alreadyVerified: true
      });
    }

    // Clean up the verification token
    await EmailVerification.deleteOne({ _id: verification._id });

    // Send welcome email (only if we successfully updated the user)
    try {
      await emailService.sendWelcomeEmail(updateResult);
      logger.info('Welcome email sent', { email: updateResult.email, userId: updateResult.id });
    } catch (emailError) {
      logger.error('Failed to send welcome email', { email: updateResult.email, userId: updateResult.id }, emailError as Error);
      // Continue with verification even if welcome email fails
    }

    // Generate JWT token for immediate login
    const authToken = jwt.sign({ id: updateResult.id, email: updateResult.email, name: updateResult.name }, JWT_SECRET, { expiresIn: '7d' });
    
    // Set cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', authToken, { 
      httpOnly: true, 
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ 
      message: 'Email verified successfully',
      user: { id: updateResult.id, email: updateResult.email, name: updateResult.name, emailVerified: true },
      token: authToken
    });
  } catch (err) {
    logger.error('Email verification error', {}, err as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Remove any existing verification tokens for this user
    await EmailVerification.deleteMany({ userId: user._id });

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save new verification token
    await EmailVerification.create({
      userId: user._id,
      token: verificationToken,
      expiresAt
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, verificationToken);
      return res.json({ message: 'Verification email sent successfully' });
    } catch (emailError) {
      logger.error('Failed to send verification email', { email }, emailError as Error);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }
  } catch (err) {
    logger.error('Resend verification error', {}, err as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Test email configuration
router.get('/test-email', async (req, res) => {
  try {
    const isConnected = await emailService.testConnection();
    if (isConnected) {
      return res.json({ message: 'Email service connection successful' });
    } else {
      return res.status(500).json({ error: 'Email service connection failed' });
    }
  } catch (error) {
    logger.error('Email test error', {}, error as Error);
    return res.status(500).json({ error: 'Email test failed' });
  }
});

// Forgot password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await PasswordResetService.forgotPassword(email.toLowerCase().trim());
    
    if (result.success) {
      return res.json({ message: result.message });
    } else {
      return res.status(400).json({ error: result.message });
    }
  } catch (error) {
    logger.error('Forgot password error', {}, error as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify reset token
router.get('/verify-reset-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    const result = await PasswordResetService.verifyResetToken(token);
    
    if (result.valid) {
      return res.json({ valid: true, message: 'Token is valid' });
    } else {
      return res.status(400).json({ valid: false, error: 'Invalid or expired reset token' });
    }
  } catch (error) {
    logger.error('Token verification error', {}, error as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Token, password, and password confirmation are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const result = await PasswordResetService.resetPassword(token, password);
    
    if (result.success) {
      return res.json({ message: result.message });
    } else {
      return res.status(400).json({ error: result.message });
    }
  } catch (error) {
    logger.error('Reset password error', {}, error as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get organizations owned by user (for delete account check)
router.get('/owned-organizations', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const Organization = require('../models/Organization').default;
    const ownedOrgs = await Organization.find({ ownerId: userId }).select('_id name members');
    
    return res.json({ organizations: ownedOrgs });
  } catch (err) {
    logger.error('Error fetching owned organizations', { userId: req.user?.id }, err as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Transfer organization ownership
router.post('/transfer-ownership', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { organizationId, newOwnerId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!organizationId || !newOwnerId) {
      return res.status(400).json({ error: 'Organization ID and new owner ID are required' });
    }

    const Organization = require('../models/Organization').default;
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if current user is the owner
    if (organization.ownerId.toString() !== userId) {
      return res.status(403).json({ error: 'Only organization owner can transfer ownership' });
    }

    // Check if new owner is a member of the organization
    const newOwnerMember = organization.members.find(
      (member: any) => member.userId.toString() === newOwnerId
    );

    if (!newOwnerMember) {
      return res.status(400).json({ error: 'New owner must be a member of the organization' });
    }

    // Update ownership
    organization.ownerId = newOwnerId;
    
    // Update roles in members array
    organization.members = organization.members.map((member: any) => {
      if (member.userId.toString() === newOwnerId) {
        return { ...member, role: 'owner' };
      } else if (member.userId.toString() === userId) {
        return { ...member, role: 'admin' };
      }
      return member;
    });

    await organization.save();

    return res.json({ message: 'Ownership transferred successfully' });
  } catch (err) {
    logger.error('Error transferring ownership', { userId: req.user?.id }, err as Error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get owned organizations for deletion assessment
router.get('/owned-organizations', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const organizations = await UserDeletionService.getOwnedOrganizations(req.user!.id);
    res.json({ organizations });
  } catch (error: any) {
    logger.error('Error getting owned organizations', { userId: req.user?.id }, error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Transfer organization ownership
router.post('/transfer-ownership', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { organizationId, newOwnerId } = req.body;
    
    if (!organizationId || !newOwnerId) {
      return res.status(400).json({ message: 'Organization ID and new owner ID are required' });
    }

    await UserDeletionService.transferOwnership(organizationId, req.user!.id, newOwnerId);
    res.json({ message: 'Ownership transferred successfully' });
  } catch (error: any) {
    logger.error('Error transferring ownership', { userId: req.user?.id }, error);
    res.status(500).json({ message: error.message || 'Failed to transfer ownership' });
  }
});

// Get deletion assessment
router.get('/deletion-assessment', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const assessment = await UserDeletionService.assessDeletionImpact(req.user!.id);
    res.json(assessment);
  } catch (error: any) {
    logger.error('Error assessing deletion impact', { userId: req.user?.id }, error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Delete user account
router.delete('/delete-account', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    // Final safety check - ensure user doesn't own any organizations
    const ownedOrgs = await Organization.find({ owner: req.user!.id });
    if (ownedOrgs.length > 0) {
      return res.status(400).json({ 
        message: `Cannot delete account: You still own ${ownedOrgs.length} organization(s). Please transfer ownership first.` 
      });
    }

    // Perform soft delete
    const result = await UserDeletionService.softDeleteUser(req.user!.id);
    
    // Clear the JWT cookie
    res.clearCookie('token');
    
    res.json(result);
  } catch (error: any) {
    logger.error('Error deleting account', { userId: req.user?.id }, error);
    res.status(500).json({ message: error.message || 'Failed to delete account' });
  }
});

export default router;
