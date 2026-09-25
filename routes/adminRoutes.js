const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const {
  getDashboardStats,
  addMerchant,
  getAllMerchants,
  updateMerchant,
  updateMerchantStatus,
  getMerchantsDropdownList,
  getAllCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerStatus,
  addCategory,
  deleteCategory
} = require('../controllers/adminController');

// حماية جميع مسارات الأدمن تلقائياً
router.use(verifyToken, requireRole('admin'));

// إحصائيات لوحة التحكم
router.get('/dashboard-stats', getDashboardStats);

// مسارات إدارة التجار
router.post('/merchants', addMerchant);
router.get('/merchants', getAllMerchants);
router.put('/merchants/:id', updateMerchant);
router.patch('/merchants/:id/status', updateMerchantStatus);

// مسارات إدارة الزبائن
router.get('/customers', getAllCustomers);
router.post('/customers', addCustomer);
router.put('/customers/:id', updateCustomer);
router.delete('/customers/:id', deleteCustomer);
router.patch('/customers/:id/status', updateCustomerStatus);

// مسارات إدارة التصنيفات
router.post('/categories', addCategory);
router.delete('/categories/:id', deleteCategory);

module.exports = router;