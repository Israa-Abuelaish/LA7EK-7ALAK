// middleware/verifyToken.js
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'غير مصرح: التوكن مفقود أو غير مكتمل' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'غير مصرح: التوكن غير صالح' });
    }

    // فك التوكن والتحقق منه
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.sub;

    if (!userId) {
      return res.status(401).json({ error: 'التوكن غير صالح: معرف المستخدم مفقود' });
    }

    // التحقق من أن الـ ID رقم صحيح
    const parsedUserId = Number(userId);
    if (isNaN(parsedUserId) || !Number.isInteger(parsedUserId)) {
      return res.status(401).json({ error: 'التوكن غير صالح: المعرف غير صحيح' });
    }

    // جلب المستخدم مع ملفاته المرتبطة بكفاءة
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
      include: {
        merchantProfile: true,
        customerProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'المستخدم المرتبط بهذا التوكن لم يعد موجوداً' });
    }

    // التحقق من حالة الحساب (محظور أو موقوف)
    if (user.status === 'banned' || user.status === 'suspended') {
      return res.status(403).json({ error: 'عذراً، هذا الحساب موقوف أو محظور' });
    }

    // حقن بيانات المستخدم في الـ request لاستخدامها لاحقاً
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      merchantId: user.merchantProfile?.id || null,
      customerId: user.customerProfile?.id || null
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'التوكن المستخدم مزيف أو غير صالح' });
    }
    
    console.error('❌ Auth Middleware Error:', error);
    return res.status(500).json({ error: 'حدث خطأ داخلي أثناء مصادقة المستخدم' });
  }
};

module.exports = verifyToken;