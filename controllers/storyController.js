const prisma = require('../config/prisma');

const shapeMerchant = (merchant) => {
  if (!merchant) return merchant;
  const store = merchant.user?.Store?.[0] || null;
  const city = store?.city || merchant.City || null;
  return {
    ...merchant,
    name: store?.name || merchant.storeName || merchant.user?.name || 'متجر',
    storeName: store?.name || merchant.storeName || 'متجر',
    category: store?.category?.name || null,
    city: city?.area || null,
    cityName: city?.area || null,
    store: store
      ? {
        ...store,
        categoryName: store.category?.name || null,
        cityName: city?.area || null
      }
      : null
  };
};

// 1. إضافة ستوري جديدة مع إرسال إشعار للأدمن
const addStory = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'merchant') {
      return res.status(403).json({ error: 'غير مصرح لك بإضافة ستوري' });
    }

    const { mediaUrl, description, discountPercentage } = req.body;

    let merchantId;
    if (req.user.role === 'admin') {
      merchantId = parseInt(req.body.merchantId);
      if (!merchantId) {
        return res.status(400).json({ error: 'يرجى اختيار المتجر' });
      }
    } else {
      merchantId = req.user.merchantId;
      if (!merchantId) {
        return res.status(400).json({ error: 'هذا الحساب غير مرتبط بمتجر تاجر' });
      }
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { user: true }
    });
    if (!merchant) {
      return res.status(404).json({ error: 'المتجر غير موجود' });
    }
    if (merchant.user?.status !== 'active') {
      return res.status(403).json({ error: 'لا يمكن إضافة ستوري لمتجر غير نشط' });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        merchantId,
        mediaUrl,
        description,
        discountPercentage: discountPercentage ? parseFloat(discountPercentage) : null,
        expiresAt,
        status: 'active'
      },
      include: {
        merchant: {
          include: {
            user: { include: { Store: { include: { category: true, city: true } } } }
          }
        }
      }
    });

    // 🔔 إشعار الأدمن بعد إضافة أي ستوري، سواء أضافها تاجر أو أدمن
    const store = story.merchant?.user?.Store?.[0];
    const merchantName = story.merchant?.storeName
      || store?.name
      || story.merchant?.user?.name
      || 'تاجر';
    const admins = await prisma.user.findMany({ where: { role: 'admin' } });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          title: 'ستوري جديدة',
          message: `تمت إضافة ستوري جديدة من قبل: ${merchantName}`,
          type: 'story'
        }))
      });
    }

    res.status(201).json({ message: 'تم نشر الستوري بنجاح', story });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. جلب الستوريات الحية
const getActiveStories = async (req, res) => {
  try {
    const now = new Date();
    await prisma.story.updateMany({
      where: {
        status: 'active',
        expiresAt: { lte: now }
      },
      data: { status: 'inactive' }
    });

    const stories = await prisma.story.findMany({
      where: {
        status: 'active',
        expiresAt: { gt: now }
      },
      include: {
        merchant: {
          include: {
            user: {
              include: {
                Store: { include: { category: true, city: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = stories.map((s) => ({
      ...s,
      merchant: shapeMerchant(s.merchant)
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. حذف ستوري
const deleteStory = async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    if (!Number.isInteger(storyId)) {
      return res.status(400).json({ error: 'معرّف الستوري غير صالح' });
    }
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      return res.status(404).json({ error: 'القصة غير موجودة' });
    }

    const isAdminUser = req.user.role === 'admin';
    const isOwnerMerchant = req.user.role === 'merchant' && req.user.merchantId === story.merchantId;

    if (!isAdminUser && !isOwnerMerchant) {
      return res.status(403).json({ error: 'ليس لديك الصلاحية لحذف هذه القصة' });
    }

    await prisma.story.delete({ where: { id: storyId } });
    res.status(200).json({ message: 'تم حذف القصة بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. جلب قائمة المتاجر للأدمن (مع التصنيف والمدينة الحقيقيين من جدول Store)
const getMerchantsList = async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      where: {
        user: { status: 'active' }
      },
      include: {
        user: {
          include: {
            Store: { include: { category: true, city: true } }
          }
        }
      }
    });

    const formatted = merchants.map(m => {
      const store = m.user?.Store?.[0] || null;
      return {
        id: m.id,
        name: m.storeName || m.user?.name || 'متجر',
        storeName: store?.name || m.storeName || 'متجر',
        category: store?.category?.name || null,
        city: store?.city?.area || null,
        cityName: store?.city?.area || null
      };
    });



    res.status(200).json(formatted);
  } catch (error) {
    console.error("PRISMA ERROR DETAILS:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addStory,
  getActiveStories,
  deleteStory,
  getMerchantsList
};