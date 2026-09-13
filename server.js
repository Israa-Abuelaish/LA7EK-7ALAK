// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// إعداد الـ CORS لربط Vercel بـ Railway
const allowedOrigins = [
  'https://la7ek7alak.vercel.app',    
  'https://la7ek-7alak.vercel.app',   
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // السماح للطلبات التي ليس لها origin (مثل Postman أو السيرفر الداخلي) أو الموجودة في القائمة
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // السماح بـ OPTIONS بوضوح
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));



app.use(express.json());

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

const storyRoutes = require('./routes/storyRoutes');
app.use('/api/stories', storyRoutes);

const storeStoryRoutes = require('./routes/storeStoryRoutes');
app.use('/api/stores', storeStoryRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});