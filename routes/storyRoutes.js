const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// 1. إضافة ستوري جديدة من قبل التاجر (تختفي بعد 24 ساعة)
router.post('/addstories', async (req, res) => {
  try {
    const { merchantId, mediaUrl, description, discountPercentage } = req.body;

    // حساب وقت الانتهاء بعد 24 ساعة بدقة
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        merchantId: parseInt(merchantId),
        mediaUrl,
        description,
        discountPercentage: discountPercentage ? parseFloat(discountPercentage) : null,
        expiresAt,
        status: 'active'
      }
    });

    res.status(201).json({ message: 'تم نشر الستوري بنجاح وستبقى لمدة 24 ساعة', story });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. جلب الستوريات الحية فقط (التي لم ينقضِ عليها 24 ساعة)
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    const activeStories = await prisma.story.findMany({
      where: {
        expiresAt: { gt: now },
        status: 'active'
      },
      include: {
        merchant: {
          include: {
            user: true,
            subscriptions: { where: { status: 'active' } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(activeStories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 3. حذف ستوري من قبل التاجر أو الأدمن
router.delete('/:id', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    const { userId, role } = req.body; 

    // 1. البحث عن الستوري للتأكد من وجودها ومعرفة التاجر المرتبط بها
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: {
        merchant: true // لجلب بيانات التاجر المرتبط بالقصة
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'القصة غير موجودة' });
    }

    // 2. التحقق من صلاحيات الحذف:
    // هل المستخدم هو الأدمن؟ أم هل هو نفس التاجر مالك المتجر الذي أنشأ الستوري؟
    const isAdmin = role === 'admin';
    const isOwnerMerchant = role === 'merchant' && story.merchant.userId === parseInt(userId);

    if (!isAdmin && !isOwnerMerchant) {
      return res.status(403).json({ error: 'ليس لديك الصلاحية لحذف هذه القصة' });
    }

    // 3. تنفيذ الحذف النهائي من قاعدة البيانات
    await prisma.story.delete({
      where: { id: storyId }
    });


    res.json({ message: 'تم حذف القصة بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;