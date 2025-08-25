import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import Notification from '../models/Notification';

const router = Router();

// Get notifications for current user
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user!.id,
    })
      .populate({
        path: 'sender',
        select: 'name email',
        match: { deleted: { $ne: true } }, // Only populate non-deleted users
      })
      .populate('relatedTask', 'title')
      .populate('relatedOrganization', 'name')
      .populate('relatedProject', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    // Transform notifications to handle deleted senders
    const transformedNotifications = notifications.map(notification => {
      const notificationObj = notification.toObject();

      // If sender is null (deleted user), use senderName as fallback
      if (!notificationObj.sender && notificationObj.senderName) {
        // Replace the sender field with fallback data
        (notificationObj as any).sender = {
          _id: null,
          name: notificationObj.senderName,
          email: null,
        };
      }

      return notificationObj;
    });

    res.json(transformedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user!.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await Notification.updateMany({ recipient: req.user!.id, read: false }, { read: true });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user!.id,
      read: false,
    });

    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

export default router;
