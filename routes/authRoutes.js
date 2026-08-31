const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  },
  tls: {
    rejectUnauthorized: false
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'la7ek7alak_secret_key';


// تسجيل حساب جديد (مستهلك أو تاجر)
router.post('/register', async (req, res) => {
  console.log("البيانات المستقبلة من التطبيق:", req.body);
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول المطلوبة' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
    }

    const phoneRegex = /^0[0-9]{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        error: 'رقم الهاتف غير صالح. يجب أن يتكون من 10 خانات ويبدأ بالرقم 0' 
      });
    }

    // التحقق إن كان البريد مستخدماً مسبقاً
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
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
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ error: 'فشل إنشاء الحساب', details: error.message });
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
          <h3>مرحباً ${user.name || 'مستخدمنا العزيز'}،</h3>
          <p>لقد طلبت استعادة كلمة المرور الخاصة بك في تطبيق <b>لاحق حالك</b>.</p>
          <p>رمز التحقق الخاص بك هو:</p>
          <h2 style="color: #4f46e5; letter-spacing: 2px;">${resetToken}</h2>
          <p>هذا الرمز صالح لمدة <b>10 دقائق فقط</b>.</p>
        </div>
      `
    });

    res.status(200).json({ message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح' });
  } catch (error) {
    console.error("EMAIL ERROR:", error);
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