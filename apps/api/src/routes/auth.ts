import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
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
    const user = await User.create({ email, name, passwordHash: hash });
    const token = jwt.sign({ id: user.id, email, name }, JWT_SECRET, { expiresIn: '7d' });
    
    // Set cookie with proper cross-domain settings
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, { 
      httpOnly: true, 
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      domain: isProduction ? '.vercel.app' : undefined
    });
    
    return res.status(201).json({ user: { id: user.id, email, name }, token });
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

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    
    // Set cookie with proper cross-domain settings
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, { 
      httpOnly: true, 
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      domain: isProduction ? '.vercel.app' : undefined
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
  const user = await User.findById(id).select('_id email name');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

export default router;
