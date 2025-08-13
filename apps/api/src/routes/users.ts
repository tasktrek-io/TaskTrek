import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();

// Search users by email (prefix match)
router.get('/search', requireAuth, async (req: AuthedRequest, res: Response) => {
  const q = (req.query?.email as string) || '';
  const users = await User.find({ email: { $regex: `^${q}`, $options: 'i' } }).select('_id email name').limit(10);
  res.json(users);
});

export default router;
