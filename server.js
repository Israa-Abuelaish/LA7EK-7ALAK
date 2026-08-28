const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());

// استدعاء مسارات الأدمن
const adminRoutes = require('./routes/adminRoutes'); 
app.use('/api', adminRoutes);

//  Auth APIs (مسارات المصادقة والتسجيل)
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

//  Story APIs (مسارات القصص المؤقتة)
const storyRoutes = require('./routes/storyRoutes');
app.use('/api/stories', storyRoutes);

// Server Initialization (تشغيل السيرفر)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running successfully on port ${PORT}`);
});