const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const router = express.Router();
const prisma = new PrismaClient();

// إعداد Nodemailer 
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', 
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4 
});

const JWT_SECRET = process.env.JWT_SECRET || 'la7ek7alak_secret_key';

// ==========================================
// 1. ADMIN DASHBOARD (لوحة تحكم الأدمن)
// ==========================================

// أ) تسجيل دخول الأدمن
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مسموح لك بالدخول كأدمن' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({ message: 'تم تسجيل دخول الأدمن بنجاح', token });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في تسجيل دخول الأدمن', details: error.message });
  }
});

// ب) إنشاء تاجر ومتجر (حصرياً للأدمن)
router.post('/admin/merchants', async (req, res) => {
  try {
    const { fullName, email, password, phone, storeName, categoryId, cityId } = req.body;

    if (!fullName || !email || !password || !phone || !storeName || !categoryId || !cityId) {
      return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول المطلوبة للتاجر والمتجر' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // استخدام المعاملات (Transaction) لضمان إنشاء التاجر ومتجره معاً
    const result = await prisma.$transaction(async (prisma) => {
      const newMerchant = await prisma.user.create({
        data: {
          fullName,
          email,
          password: hashedPassword,
          phone, 
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

    res.status(201).json({
      message: 'تم إنشاء حساب التاجر والمتجر بنجاح',
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل إنشاء التاجر والمتجر', details: error.message });
  }
});



// ج) جلب قائمة التجار مع الفلترة
router.get('/admin/merchants', async (req, res) => {
  try {
    const { cityId, categoryId, status } = req.query;

    const filters = { role: 'merchant' };
    if (status) filters.status = status;

    const merchants = await prisma.user.findMany({
      where: filters,
      include: {
        stores: {
          where: {
            ...(cityId && { cityId: parseInt(cityId) }),
            ...(categoryId && { categoryId: parseInt(categoryId) })
          },
          include: { category: true, city: true }
        }
      }
    });

    // تصفية المستخدمين الذين لديهم متاجر مطابقة للفلتر
    const filteredMerchants = merchants.filter(m => m.stores.length > 0);

    res.status(200).json({ count: filteredMerchants.length, data: filteredMerchants });
  } catch (error) {
    res.status(500).json({ error: 'فشل جلب قائمة التجار', details: error.message });
  }
});


// د) تغيير حالة التاجر (تفعيل / إيقاف)
router.patch('/admin/merchants/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' أو 'inactive'

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'الحالة المدخلة غير صالحة' });
    }

    const updatedMerchant = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.status(200).json({
      message: 'تم تحديث حالة التاجر بنجاح',
      data: { id: updatedMerchant.id, fullName: updatedMerchant.fullName, email: updatedMerchant.email, status: updatedMerchant.status }
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل تحديث حالة التاجر', details: error.message });
  }
});




// GET /api/admin/filter-users: فلترة متقدمة للمستخدمين والتجار
router.get('/admin/filter-users', async (req, res) => {
  console.log("الـ Query المستلمة من الرابط:", req.query);
  try {
    const { role, status, cityId, categoryId, search } = req.query;

    // بناء كائن الشروط الأساسي
    let whereCondition = {};

    // 1. فلترة حسب الدور (مثل 'customer' أو 'merchant' أو 'admin')
    if (role) {
      whereCondition.role = role;
    }

    // 2. فلترة حسب حالة الحساب (مثل 'active' أو 'inactive')
    if (status) {
      whereCondition.status = status;
    }

    // 3. فلترة نصية عامة (بالاسم أو البريد الإلكتروني)
    if (search) {
      whereCondition.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 4. إذا كانت الفلترة تتعلق بالمتاجر (المدينة أو التصنيف)
    if (cityId || categoryId) {
      whereCondition.stores = {
        some: {
          ...(cityId && { cityId: parseInt(cityId) }),
          ...(categoryId && { categoryId: parseInt(categoryId) })
        }
      };
    }

    // تنفيذ الاستعلام عبر Prisma مع جلب تفاصيل المتاجر إن وجدت
   const results = await prisma.user.findMany({
      where: whereCondition,
      include: {
        stores: {
          include: {
            city: true,
            category: true 
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (error) {
    console.error("FILTER ERROR:", error);
    res.status(500).json({ error: 'فشل عملية التصفية', details: error.message });
  }
});



// حذف متجر معين بشكل مستقل
router.delete('/admin/stores/:id', async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);

    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return res.status(404).json({ error: 'المتجر غير موجود' });
    }

    await prisma.store.delete({
      where: { id: storeId }
    });

    res.status(200).json({
      message: 'تم حذف المتجر بنجاح',
      deletedStoreId: storeId
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء محاولة حذف المتجر', details: error.message });
  }
});

module.exports = router;