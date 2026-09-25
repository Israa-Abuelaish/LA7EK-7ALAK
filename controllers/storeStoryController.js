const prisma = require('../config/prisma');

// 1. متابعة متجر من قبل الزبون
const followStore = async (req, res) => {
  try {
    const customerId = req.user.customerId || req.user.id;
    const { merchantId } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: 'معرف المتجر مطلوب' });
    }

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
};

// 2. إلغاء متابعة متجر
const unfollowStore = async (req, res) => {
  try {
    const customerId = req.user.customerId || req.user.id;
    const { merchantId } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: 'يرجى إرسال معرف المتجر' });
    }

    await prisma.follow.deleteMany({
      where: {
        customerId: parseInt(customerId),
        merchantId: parseInt(merchantId)
      }
    });

    res.status(200).json({ message: 'تم إلغاء المتابعة بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. تقييم المتجر (بالنجوم)
const rateStore = async (req, res) => {
  try {
    const customerId = req.user.customerId || req.user.id;
    const { merchantId, rating, review } = req.body;

    if (!merchantId || !rating) {
      return res.status(400).json({ error: 'معرف المتجر وقيمة التقييم مطلوبان' });
    }
    
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
};

module.exports = {
  followStore,
  unfollowStore,
  rateStore
};