import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import EmailVerification from '../models/EmailVerification';
import EmailService from '../services/EmailService';

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

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

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
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    return res.status(201).json({ 
      message: 'Registration successful. Please check your email to verify your account.',
      user: { id: user.id, email, name, emailVerified: false },
      requiresVerification: true
    });
  } catch (err) {
    console.error(err);
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
    console.error(err);
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
    console.error('Error updating profile:', err);
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
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Update user verification status
    user.emailVerified = true;
    await user.save();

    // Clean up the verification token
    await EmailVerification.deleteOne({ _id: verification._id });

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue with verification even if welcome email fails
    }

    // Generate JWT token for immediate login
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
      message: 'Email verified successfully',
      user: { id: user.id, email: user.email, name: user.name, emailVerified: true },
      token: authToken
    });
  } catch (err) {
    console.error('Email verification error:', err);
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
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }
  } catch (err) {
    console.error('Resend verification error:', err);
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
    console.error('Email test error:', error);
    return res.status(500).json({ error: 'Email test failed' });
  }
});

export default router;
