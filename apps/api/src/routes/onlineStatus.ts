import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { socketServer } from '../socket/socketServer';
import { logger } from '../utils/logger';

const router = Router();

// Get online status for specific users
router.get('/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userIds } = req.query;

    if (!userIds) {
      return res.status(400).json({ message: 'userIds query parameter is required' });
    }

    // Parse userIds - can be comma-separated string or array
    let userIdArray: string[] = [];
    if (typeof userIds === 'string') {
      userIdArray = userIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
    } else if (Array.isArray(userIds)) {
      userIdArray = userIds.map(id => String(id).trim()).filter(id => id.length > 0);
    }

    const onlineStatus = socketServer.getOnlineStatusForUsers(userIdArray);

    res.json({
      success: true,
      onlineStatus,
    });
  } catch (error) {
    logger.error('Error getting online status', {}, error as Error);
    res.status(500).json({ message: 'Failed to get online status' });
  }
});

// Get all currently online users
router.get('/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const onlineUsers = socketServer.getOnlineUsers();

    res.json({
      success: true,
      users: onlineUsers,
      count: onlineUsers.length,
    });
  } catch (error) {
    logger.error('Error getting online users', {}, error as Error);
    res.status(500).json({ message: 'Failed to get online users' });
  }
});

// Get connected users count
router.get('/count', requireAuth, async (req: Request, res: Response) => {
  try {
    const count = socketServer.getConnectedUsersCount();

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    logger.error('Error getting connected users count', {}, error as Error);
    res.status(500).json({ message: 'Failed to get connected users count' });
  }
});

export default router;
