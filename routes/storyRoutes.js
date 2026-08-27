const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// 1. نشر قصة أو عرض جديد (مخصص للتاجر المرتبط بمتجر)
// ==========================================
router.post('/', async (req, res) => {
  try {
   
    const { storeId, mediaUrl, caption } = req.body;

    if (!storeId || !mediaUrl) {
      return res.status(400).json({ error: 'الرجاء إدخال معرف المتجر ورابط الوسائط (الصورة/الفيديو)' });
    }

    // التحقق من أن المتجر موجود
    const store = await prisma.store.findUnique({ where: { id: parseInt(storeId) } });
    if (!store) {
      return res.status(404).json({ error: 'المتجر غير موجود' });
    }

    // إنشاء القصة في قاعدة البيانات (تنتهي غالباً خلال 24 ساعة افتراضياً)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newStory = await prisma.story.create({
      data: {
        storeId: parseInt(storeId),
        mediaUrl,
        caption: caption || '',
        expiresAt
      }
    });

    res.status(201).json({
      message: 'تم نشر القصة بنجاح',
      data: newStory
    });

  } catch (error) {
    res.status(500).json({ error: 'فشل نشر القصة', details: error.message });
  }
});


// ==========================================
// 2. جلب جميع القصص النشطة (مخصص لتطبيق المستهلكين - Flutter)
// ==========================================
router.get('/', async (req, res) => {
  try {
    const now = new Date();

    // جلب القصص التي لم تنتهي صلاحيتها بعد (expiresAt أكبر من الوقت الحالي)
    const activeStories = await prisma.story.findMany({
      where: {
        expiresAt: {
          gt: now
        }
      },
      include: {
        store: { // جلب تفاصيل المتجر التابع له القصة (مثل اسم المتجر وصورته)
          include: {
            city: true,
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc' // ترتيبها من الأحدث للأقدم
      }
    });

    res.status(200).json({
      count: activeStories.length,
      data: activeStories
    });

  } catch (error) {
    res.status(500).json({ error: 'فشل جلب القصص', details: error.message });
  }
});

module.exports = router;