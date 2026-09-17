const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');


// 1. جلب كافة الإشعارات
router.get('/', async (req, res) => {
  try {
    // استعلام القاعدة لاسترجاع الإشعارات مرتبة من الأحدث للأقدم
    // const notifications = await Notification.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, notifications: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. تحديث إشعار إلى مقروء
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    // await Notification.findByIdAndUpdate(id, { isRead: true });
    res.status(200).json({ success: true, message: 'تم تحديث الإشعار' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. تحديد الكل كمقروء
router.patch('/read-all', async (req, res) => {
  try {
    // await Notification.updateMany({}, { isRead: true });
    res.status(200).json({ success: true, message: 'تم تحديد كافة الإشعارات كمقروءة' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. حذف إشعار
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // await Notification.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'تم حذف الإشعار بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;