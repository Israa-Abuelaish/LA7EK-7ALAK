const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const {
  addStory,
  getActiveStories,
  deleteStory,
  getMerchantsList
} = require('../controllers/storyController');

// 1. إضافة ستوري جديدة (محمي للتاجر والأدمن)
router.post('/addstories', verifyToken, addStory);

// 2. جلب الستوريات الحية (عام لجميع المستخدمين)
router.get('/active', getActiveStories);

// 3. حذف ستوري (محمي)
router.delete('/:id', verifyToken, deleteStory);

// 4. جلب قائمة المتاجر (محمي للأدمن فقط)
router.get('/merchants-list', verifyToken, requireRole('admin'), getMerchantsList);

module.exports = router;