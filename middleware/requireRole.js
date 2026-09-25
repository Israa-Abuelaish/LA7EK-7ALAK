// middleware/requireRole.js
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول أولاً' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء' });
    }

    next();
  };
};

module.exports = requireRole;