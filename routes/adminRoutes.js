const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const router = express.Router();
const prisma = new PrismaClient();

// إعداد Nodemailer (تأكد من وضع بيانات البريد الحقيقية أو متغيرات البيئة)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
  port: process.env.EMAIL_PORT || 2525,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'la7ek7alak_secret_key';

// ==========================================
// 1. AUTHENTICATION (المستهلكين وتطبيق الجوال)
// ==========================================

// تسجيل حساب جديد (مخصص للمستهلكين فقط - Customer)
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول المطلوبة' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
    }

    // التحقق إن كان الإيميل مستخدماً مسبقاً
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        role: 'customer' // مثبت دائماً كمستهلك
      }
    });

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      user: { id: newUser.id, fullName: newUser.fullName, email: newUser.email, role: newUser.role }
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل إنشاء الحساب', details: error.message });
  }
});

// تسجيل الدخول المشترك (مستهلك أو تاجر)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // التحقق من حالة الحساب (إذا كان التاجر موقوفاً)
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'حسابك موقوف حالياً، يرجى مراعاة الإدارة' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في تسجيل الدخول', details: error.message });
  }
});






// ==========================================
// 2. ADMIN DASHBOARD (لوحة تحكم الأدمن)
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
    const { fullName, email, password, storeName, categoryId, cityId } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    // استخدام المعاملات (Transaction) لضمان إنشاء التاجر ومتجره معاً
    const result = await prisma.$transaction(async (prisma) => {
      const newMerchant = await prisma.user.create({
        data: {
          fullName,
          email,
          password: hashedPassword,
          phone: null,
          role: 'merchant' // مثبت كتاجر
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

module.exports = router;