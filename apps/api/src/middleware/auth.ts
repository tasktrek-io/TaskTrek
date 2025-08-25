import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthPayload {
  id: string;
  email: string;
  name: string;
}

export type AuthedRequest = Request & { user?: AuthPayload } & { cookies?: Record<string, string> };

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers?.authorization;
    const bearer =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    const cookieToken = req.cookies?.token;
    const token = bearer || cookieToken;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireVerifiedUser(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      if (!user.emailVerified) {
        return res.status(403).json({
          error: 'Email verification required',
          requiresVerification: true,
        });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
}
