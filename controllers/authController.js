const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. تسجيل حساب جديد (للزبائن فقط)
const register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'الاسم، البريد الإلكتروني، وكلمة المرور مطلوبون' });
    }

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
        customerProfile: { create: { address } }
      },
      include: { customerProfile: true }
    });

    // 🔔 [إضافة هنا]: إرسال إشعار للأدمن بأن زبوناً جديداً قد سجل
    try {
      const admins = await prisma.user.findMany({ where: { role: 'admin' } });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            title: 'تسجيل حساب زبون جديد',
            message: `تم تسجيل حساب زبون جديد باسم: ${name}`,
            type: 'user_register',
            isRead: false
          }))
        });
      }
    } catch (notifError) {
      console.error('⚠️ فشل إرسال إشعار تسجيل الزبون:', notifError.message);
    }

    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user: newUser });
  } catch (error) {
    console.error('❌ Register Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' });
  }
};

// 2. تسجيل الدخول
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

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

    res.status(200).json({
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
    console.error('❌ Login Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
};

// 3. طلب استعادة كلمة المرور
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'البريد الإلكتروني غير مسجل' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otpCode, otpExpiresAt }
    });

    res.status(200).json({ message: 'تم إرسال رمز التحقق بنجاح', otpCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. إعادة تعيين كلمة المرور
const resetPassword = async (req, res) => {
  try {
    const { email, otpCode, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otpCode !== otpCode || new Date() > user.otpExpiresAt) {
      return res.status(400).json({ error: 'رمز التحقق غير صحيح أو انتهت صلاحيته' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, otpCode: null, otpExpiresAt: null }
    });

    res.status(200).json({ message: 'تم تحديث كلمة المرور بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword
};