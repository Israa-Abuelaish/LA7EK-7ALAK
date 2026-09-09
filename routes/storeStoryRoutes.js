const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');


// 1. متابعة متجر من قبل الزبون
router.post('/follows', async (req, res) => {
  try {
    const { customerId, merchantId } = req.body;
    const follow = await prisma.follow.create({
      data: {
        customerId: parseInt(customerId),
        merchantId: parseInt(merchantId)
      }
    });
    res.status(201).json({ message: 'تمت متابعة المتجر بنجاح', follow });
  } catch (error) {
    res.status(400).json({ error: 'أنت تتابع هذا المتجر مسبقاً' });
  }
});

// 2. إلغاء المتابعة
// إلغاء متابعة متجر من قبل الزبون
router.delete('/follows', async (req, res) => {
  try {
    const { customerId, merchantId } = req.body;

    // التحقق من وجود معرف الزبون ومعرف التاجر
    if (!customerId || !merchantId) {
      return res.status(400).json({ error: 'يرجى إرسال معرف الزبون ومعرف التاجر' });
    }

    // حذف سجل المتابعة من جدول Follow
    await prisma.follow.deleteMany({
      where: {
        customerId: parseInt(customerId),
        merchantId: parseInt(merchantId)
      }
    });

    res.json({ message: 'تم إلغاء المتابعة بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// 3. تقييم المتجر (بالنجوم)
router.post('/ratings', async (req, res) => {
  try {
    const { customerId, merchantId, rating, review } = req.body;
    
    // استخدام upsert لتحديث التقييم أو إنشائه إذا لم يكن موجوداً
    const storeRating = await prisma.rating.upsert({
      where: {
        customerId_merchantId: {
          customerId: parseInt(customerId),
          merchantId: parseInt(merchantId)
        }
      },
      update: { rating: parseInt(rating), review },
      create: {
        customerId: parseInt(customerId),
        merchantId: parseInt(merchantId),
        rating: parseInt(rating),
        review
      }
    });

    res.status(201).json({ message: 'تم حفظ التقييم بنجاح', storeRating });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
