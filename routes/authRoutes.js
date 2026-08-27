const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'la7ek7alak_secret_key';

// ==========================================
// 1. لوحة تحكم الأدمن (React Endpoints)
// ==========================================

// POST /api/admin/login: تسجيل دخول الأدمن
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await prisma.user.findUnique({ where: { email } });
    
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'غير مسجل كأدمن أو الحساب غير موجود' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({ message: 'تم تسجيل دخول الأدمن بنجاح', token, admin });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في السيرفر', details: error.message });
  }
});

// POST /api/admin/merchants: إنشاء تاجر ومتجر جديد
router.post('/admin/merchants', async (req, res) => {
  try {
    const { name, email, password, storeName, categoryId, cityId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (prisma) => {
      const newMerchant = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'merchant',
          status: 'active'
        }
      });

      const newStore = await prisma.store.create({
        data: {
          name: storeName,
          userId: newMerchant.id,
          categoryId: parseInt(categoryId),
          cityId: parseInt(cityId)
        }
      });

      return { newMerchant, newStore };
    });

    res.status(201).json({ message: 'تم إنشاء التاجر والمتجر بنجاح', data: result });
  } catch (error) {
    res.status(500).json({ error: 'فشل إنشاء التاجر', details: error.message });
  }
});

// GET /api/admin/merchants: جلب قائمة التجار مع الفلترة (المنطقة أو التصنيف)
router.get('/admin/merchants', async (req, res) => {
  try {
    const { cityId, categoryId } = req.query;
    const storeFilter = {};
    if (cityId) storeFilter.cityId = parseInt(cityId);
    if (categoryId) storeFilter.categoryId = parseInt(categoryId);

    const merchants = await prisma.user.findMany({
      where: {
        role: 'merchant',
        stores: { some: storeFilter }
      },
      include: {
        stores: {
          include: { city: true, category: true }
        }
      }
    });

    res.status(200).json({ success: true, count: merchants.length, merchants });
  } catch (error) {
    res.status(500).json({ error: 'فشل جلب التجار', details: error.message });
  }
});

// PATCH /api/admin/merchants/:id/status: تغيير حالة حساب التاجر (تفعيل / إيقاف)
router.patch('/admin/merchants/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // active أو inactive

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'الحالة غير صالحة، يجب أن تكون active أو inactive' });
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.status(200).json({ message: 'تم تحديث حالة التاجر بنجاح', merchant: updated });
  } catch (error) {
    res.status(500).json({ error: 'فشل التحديث', details: error.message });
  }
});


// ==========================================
// 2. تطبيق الجوال (Flutter Endpoints)
// ==========================================

// تسجيل حساب جديد (مستهلك أو تاجر)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول المطلوبة' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'customer' // <-- مثبت دائماً كـ مستهلك بغض النظر عن طلب المستخدم
      }
    });

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل إنشاء الحساب، البريد الإلكتروني قد يكون مستخدماً مسبقاً', details: error.message });
  }
});

// تسجيل الدخول لتطبيق الجوال
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.status === 'inactive') {
      return res.status(401).json({ error: 'الحساب غير موجود أو تم إيقافه من قبل الإدارة' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ message: 'تم تسجيل الدخول بنجاح', token, user });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في تسجيل الدخول', details: error.message });
  }
});



// ==========================================
// 3. مسارات الحذف للأدمن (Delete Endpoints)
// ==========================================

// حذف مستخدم معين (وسيتم حذف متجره المرتبط تلقائياً بفضل الـ Cascade)
router.delete('/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    await prisma.user.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({
      message: 'تم حذف المستخدم (والمتجر المرتبط به إن وجد) بنجاح',
      deletedUserId: id
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء محاولة حذف المستخدم', details: error.message });
  }
});

// حذف متجر معين بشكل مستقل
router.delete('/admin/stores/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({
      where: { id: parseInt(id) }
    });

    if (!store) {
      return res.status(404).json({ error: 'المتجر غير موجود' });
    }

    await prisma.store.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({
      message: 'تم حذف المتجر بنجاح',
      deletedStoreId: id
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء محاولة حذف المتجر', details: error.message });
  }
});

module.exports = router;