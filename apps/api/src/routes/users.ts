import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();

// Search users by name or email (prefix match)
router.get('/search', requireAuth, async (req: AuthedRequest, res: Response) => {
  const q = (req.query?.q as string) || '';

  if (!q.trim()) {
    return res.json([]);
  }

  // Search in both name and email fields
  const users = await User.find({
    $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }],
  })
    .select('_id email name')
    .limit(10);

  res.json(users);
});

export default router;
