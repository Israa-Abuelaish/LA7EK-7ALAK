const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');

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
    const { fullName, email, password, phone, storeName, categoryId, cityId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (prisma) => {
      const newMerchant = await prisma.user.create({
        data: {
          fullName,
          email,
          phone,
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
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول المطلوبة' });
    }

    const phoneRegex = /^0[0-9]{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        error: 'رقم الهاتف غير صالح. يجب أن يتكون من 10 خانات ويبدأ بالرقم 0' 
      });
    }
    
   const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        password: hashedPassword,
        role: 'customer'
      }
    });

   res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      user: { id: newUser.id, fullName: newUser.fullName, email: newUser.email, phone: newUser.phone, role: newUser.role }
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


////PASSWORD RECOVERY (استعادة كلمة المرور عبر OTP)
// ==========================================
// 1. طلب استعادة كلمة المرور (إرسال رمز الـ OTP)
// ==========================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'الرجاء إدخال البريد الإلكتروني' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'البريد الإلكتروني غير مسجل لدينا' });
    }

    // توليد رمز عشوائي من 6 أرقام
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // صالح لمدة 10 دقائق فقط

    // حفظ الرمز وتاريخ انتهاء الصلاحية في قاعدة البيانات
    await prisma.user.update({
      where: { email },
      data: { resetToken, tokenExpiry }
    });

    // إرسال البريد الإلكتروني
    await transporter.sendMail({
      from: '"تطبيق لاحق حالك" <support@la7ek7alak.com>',
      to: email,
      subject: 'رمز استعادة كلمة المرور',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h3>مرحباً ${user.name}،</h3>
          <p>لقد طلبت استعادة كلمة المرور الخاصة بك في تطبيق <b>لاحق حالك</b>.</p>
          <p>رمز التحقق الخاص بك هو:</p>
          <h2 style="color: #4f46e5; letter-spacing: 2px;">${resetToken}</h2>
          <p>هذا الرمز صالح لمدة <b>10 دقائق فقط</b>.</p>
        </div>
      `
    });

    res.status(200).json({ message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح' });
  }catch (error) {
  console.error("EMAIL ERROR:", error); // <-- أضف هذا السطر
  res.status(500).json({ error: 'فشل إرسال رمز التحقق', details: error.message });
}
});


// ==========================================
// 2. التحقق من صحة الرمز (Verify OTP)
// ==========================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'الرجاء إدخال البريد الإلكتروني ورمز التحقق' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // 1. التحقق من انتهاء الصلاحية أولاً
    if (user.tokenExpiry && new Date() > new Date(user.tokenExpiry)) {
      return res.status(400).json({ error: 'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد' });
    }

    // 2. ثم التحقق من مطابقة الرمز
    if (user.resetToken !== otp) {
      return res.status(400).json({ error: 'رمز التحقق غير صحيح' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'تم التحقق من الرمز بنجاح، يمكنك الآن تعيين كلمة مرور جديدة' 
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء التحقق', details: error.message });
  }
});


// ==========================================
// 3. إعادة تعيين كلمة المرور الجديدة (Reset Password)
// ==========================================
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور الجديدة' });
    }

    // تشفير كلمة المرور الجديدة
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // تحديث كلمة المرور وتفريغ حقول الـ Token حتى لا تُستخدم مرة أخرى
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetToken: null,
        tokenExpiry: null
      }
    });

    res.status(200).json({ message: 'تم تحديث كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن' });
  } catch (error) {
    res.status(500).json({ error: 'فشل تحديث كلمة المرور', details: error.message });
  }
});

module.exports = router;