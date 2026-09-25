// server.js (application entry point - Optimized)
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// إعداد الـ CORS لربط Vercel بـ Railway والبيئة المحلية
const allowedOrigins = [
  'https://la7ek7alak.vercel.app',
  'https://la7ek-7alak.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5175'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// تفعيل الوصول إلى مجلد الرفع (Uploads) لعرض الصور المرفوعة
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// تسجيل الطلبات في وضع التطوير (اختياري لكن مفيد للتتبع)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// مسارات التطبيق (API Routes)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/stores', require('./routes/storeStoryRoutes'));
app.use('/api/notifications', require('./routes/notificationsRoutes'));

// مسار افتراضي للتأكد من عمل السيرفر
app.get('/', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running successfully 🚀' });
});

// معالجة المسارات غير المعروفة (404 Not Found)
app.use((req, res, next) => {
  res.status(404).json({ error: 'المسار المطلوب غير موجود على الخادم' });
});

// معالج الأخطاء العام (Global Error Handler Middleware) - يمنع انهيار السيرفر
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'حدث خطأ داخلي في الخادم' : err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});