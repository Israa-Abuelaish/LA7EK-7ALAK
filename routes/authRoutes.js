// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. تسجيل حساب جديد (للزبائن فقط)
router.post('/register', async (req, res) => {
  console.log("🔥 تم استقبال طلب تسجيل جديد!", req.body); // أضف هذه هنا
  try {
    const { name, email, password, phone, address } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'customer',
        customerProfile: {
          create: {
            address: address 
          }
        }
      },
      include: { customerProfile: true }
    });

    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user: newUser });
  } catch (error) {
    console.error("Register Error:", error); // لتصديق الخطأ بدقة في الـ Logs
    res.status(500).json({ error: error.message });
  }
});

// 2. تسجيل الدخول (لكل الأدوار: admin, merchant, customer)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { customerProfile: true, merchantProfile: true }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'هذا الحساب غير مفعل أو تم إيقافه' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'la7ek_secret_key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: user.role === 'customer' ? user.customerProfile : user.merchantProfile
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. طلب استعادة كلمة المرور (إرسال رمز OTP وهمي أو حفظه)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'البريد الإلكتروني غير موجود' });
    }

    // توليد رمز OTP مكون من 4 أو 6 أرقام
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // صالح لمدة 15 دقيقة

    await prisma.user.update({
      where: { email },
      data: { otpCode, otpExpiresAt }
    });

    // هنا يتم إرسال الإيميل (يمكن ربطه بخدمة Nodemailer لاحقاً)
    res.json({ message: 'تم إرسال رمز التحقق بنجاح', otpCode /* للإخفاء لاحقاً في الإنتاج */ });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. إعادة تعيين كلمة المرور باستخدام الـ OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otpCode, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otpCode !== otpCode || new Date() > user.otpExpiresAt) {
      return res.status(400).json({ error: 'رمز التحقق غير صحيح أو انتهت صلاحيته' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        otpCode: null,
        otpExpiresAt: null
      }
    });

    res.json({ message: 'تم تحديث كلمة المرور بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;