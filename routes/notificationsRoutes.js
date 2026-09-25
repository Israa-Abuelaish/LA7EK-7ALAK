const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
  getUserNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  deleteNotification
} = require('../controllers/notificationController');

// جميع مسارات الإشعارات تتطلب مصادقة المستخدم
router.use(verifyToken);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;