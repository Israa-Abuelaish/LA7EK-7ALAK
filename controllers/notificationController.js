const prisma = require('../config/prisma');

// 1. جلب إشعارات المستخدم الحالي
const getUserNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('❌ get notifications error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. عدد الإشعارات غير المقروءة
const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. تحديد الكل كمقروء
const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.status(200).json({ success: true, message: 'تم تحديد كافة الإشعارات كمقروءة' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 4. تحديث إشعار محدد إلى مقروء
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id: Number(id) }
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'الإشعار غير موجود' });
    }
    if (notification.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'غير مصرح' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: Number(id) },
      data: { isRead: true }
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث الإشعار',
      updatedNotification
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 5. حذف إشعار
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id: Number(id) }
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'الإشعار غير موجود' });
    }
    if (notification.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'غير مصرح' });
    }

    await prisma.notification.delete({ where: { id: Number(id) } });
    res.status(200).json({ success: true, message: 'تم حذف الإشعار بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  deleteNotification
};