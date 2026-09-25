const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

// 1. لوحة تحكم الأدمن (الإحصائيات)
const getDashboardStats = async (req, res) => {
  try {
    const storesCount = await prisma.store.count();
    const customersCount = await prisma.user.count({ where: { role: 'customer' } });
    const merchantsCount = await prisma.user.count({ where: { role: 'merchant' } });
    const storiesCount = await prisma.story.count({ where: { status: 'active' } });

    res.status(200).json({
      storesCount,
      customersCount,
      merchantsCount,
      storiesCount
    });
  } catch (error) {
    console.error('❌ Stats Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 2. إضافة تاجر جديد من قبل الأدمن
const addMerchant = async (req, res) => {
  try {
    // 1. استقبال الإحداثيات (latitude, longitude) من الـ Request Body
    const { fullName, email, password, storeName, phone, categoryId, cityId, latitude, longitude } = req.body; 

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني موجود مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: fullName,
        email,
        password: hashedPassword,
        phone, 
        role: 'merchant',
        merchantProfile: {
          create: {
            storeName: storeName,
            wallet: { create: { balance: 0.0 } }
          }
        }
      },
      include: { merchantProfile: true }
    });

    if (newUser.merchantProfile && categoryId && cityId) {
      // 2. تمرير الإحداثيات الدقيقة عند إنشاء المتجر
      await prisma.store.create({
        data: {
          name: storeName,
          userId: newUser.id,
          categoryId: parseInt(categoryId),
          cityId: parseInt(cityId),
          latitude: latitude ? parseFloat(latitude) : null,   // خط العرض القادم من الخريطة
          longitude: longitude ? parseFloat(longitude) : null // خط الطول القادم من الخريطة
        }
      });
    }

    // 🔔 إرسال إشعار للأدمن بأن تاجراً جديداً قد تم إضافته/تسجيله
    try {
      const admins = await prisma.user.findMany({ where: { role: 'admin' } });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            title: 'تسجيل حساب تاجر جديد',
            message: `تم إضافة تاجر جديد باسم: ${fullName} (المتجر: ${storeName})`,
            type: 'merchant_register',
            isRead: false
          }))
        });
      }
    } catch (notifError) {
      console.error('⚠️ فشل إرسال إشعار تسجيل التاجر:', notifError.message);
    }

    res.status(201).json({ message: 'تم إنشاء حساب التاجر بنجاح', merchant: newUser });
  } catch (error) {
    console.error('❌ Add Merchant Error:', error);
    res.status(500).json({ error: error.message });
  }
};
// 3. جلب جميع التجار
const getAllMerchants = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'merchant' },
      include: {
        merchantProfile: true,
        Store: { include: { city: true, category: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedUsers = users.map(user => {
      const store = user.Store?.[0] || {};
      return {
        ...user,
        storeName: store.name || user.merchantProfile?.storeName || 'غير محدد',
        categoryName: store.category ? store.category.name : 'عام', 
        cityId: store.cityId || '',
        categoryId: store.categoryId || '',
      };
    });

    res.status(200).json({
      count: formattedUsers.length,
      users: formattedUsers
    });
  } catch (error) {
    console.error("❌ Get Merchants Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 4. تعديل بيانات التاجر والمتجر
const updateMerchant = async (req, res) => {
  try {
    const merchantId = Number(req.params.id);
    const { storeName, name, phone, cityId, categoryId } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: merchantId },
      data: { name, phone }
    });

    const existingStore = await prisma.store.findFirst({ where: { userId: merchantId } });

    if (existingStore) {
      await prisma.store.update({
        where: { id: existingStore.id },
        data: {
          name: storeName,
          cityId: cityId ? Number(cityId) : undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
        }
      });
    } else if (storeName && cityId && categoryId) {
      await prisma.store.create({
        data: {
          name: storeName,
          userId: merchantId,
          cityId: Number(cityId),
          categoryId: Number(categoryId)
        }
      });
    }

    res.status(200).json({ message: 'تم تحديث بيانات التاجر والمتجر بنجاح', user: updatedUser });
  } catch (error) {
    console.error("❌ Update Merchant Error:", error);
    res.status(500).json({ message: error.message || 'حدث خطأ أثناء التعديل' });
  }
};

// 5. تغيير حالة التاجر (نشط / محظور)
const updateMerchantStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { status } = req.body; 

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status }
    });

    res.status(200).json({ message: 'تم تحديث حالة التاجر بنجاح', user: updatedUser });
  } catch (error) {
    console.error("❌ Merchant Status Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// 6. قائمة المتاجر المبسطة
const getMerchantsDropdownList = async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      include: { user: true, city: true }
    });
    res.status(200).json(merchants);
  } catch (error) {
    console.error("❌ Dropdown List Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 7. جلب قائمة الزبائن
const getAllCustomers = async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'customer' },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(customers);
  } catch (error) {
    console.error('❌ Get Customers Error:', error);
    res.status(500).json({ error: error.message || 'فشل جلب قائمة الزبائن' });
  }
};

// 8. إضافة زبون جديد
const addCustomer = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الزبون مطلوب' });

    const hashedPassword = await bcrypt.hash(password || '12345678', 10);

    const newCustomer = await prisma.user.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        password: hashedPassword,
        role: 'customer',
        status: 'active'
      }
    });

    // 👈 الرد يجب أن يكون هنا داخل try بعد نجاح عملية الإنشاء مباشرة
    res.status(201).json({ message: 'تم إضافة الزبون بنجاح', customer: newCustomer });

  } catch (error) {
    console.error('❌ Add Customer Error:', error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
    res.status(500).json({ error: error.message });
  }
};

// 9. تعديل زبون
const updateCustomer = async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const { name, email, phone } = req.body;

    const updatedCustomer = await prisma.user.update({
      where: { id: customerId },
      data: { name, email, phone }
    });

    res.status(200).json({ message: 'تم تعديل بيانات الزبون بنجاح', customer: updatedCustomer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 10. حذف زبون
const deleteCustomer = async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) return res.status(400).json({ error: 'معرف غير صالح' });

    await prisma.user.delete({ where: { id: customerId } });
    res.status(200).json({ message: 'تم حذف الزبون بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 11. تغيير حالة الزبون
const updateCustomerStatus = async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const { status } = req.body;

    const updatedCustomer = await prisma.user.update({
      where: { id: customerId },
      data: { status }
    });

    res.status(200).json({ message: 'تم تغيير حالة الزبون بنجاح', customer: updatedCustomer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 12. إضافة تصنيف
const addCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;
    let category = await prisma.category.findUnique({ where: { name } });

    if (category) {
      category = await prisma.category.update({
        where: { id: category.id },
        data: { icon: icon || category.icon }
      });
      return res.status(200).json({ message: 'التصنيف موجود، تم تحديثه', category });
    }

    category = await prisma.category.create({ data: { name, icon } });
    res.status(201).json({ message: 'تم إضافة التصنيف بنجاح', category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 13. حذف تصنيف
const deleteCategory = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    await prisma.category.delete({ where: { id: categoryId } });
    res.status(200).json({ message: 'تم حذف التصنيف بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'لا يمكن حذف التصنيف لوجود متاجر مرتبطة به' });
  }
};


//14. إنشاء متجر مع تحديد الموقع الجغرافي (الإحداثيات) من قبل الأدمن    
const createStoreWithLocation = async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      password, 
      storeName, 
      phone, 
      categoryId, 
      cityId, 
      latitude,    // الإحداثي الدقيق من الخريطة
      longitude,   // الإحداثي الدقيق من الخريطة
      address      // الوصف النصي للمنطقة (مثل: البريج)
    } = req.body; 

    // 1. إنشاء المستخدم أو التحقق منه (حسب دورك)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await prisma.user.create({
      data: {
        name: fullName,
        email,
        password: hashedPassword,
        phone, 
        role: 'merchant',
      }
    });

    // 2. إنشاء المتجر مع إحداثيات الخريطة
    const newStore = await prisma.store.create({
      data: {
        name: storeName,
        userId: newUser.id,
        categoryId: parseInt(categoryId),
        cityId: parseInt(cityId),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address: address || null
      }
    });

    res.status(201).json({ 
      message: 'تم إنشاء المتجر وتحديد الموقع الجغرافي بنجاح', 
      store: newStore 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  addMerchant,
  getAllMerchants,
  updateMerchant,
  updateMerchantStatus,
  getMerchantsDropdownList,
  getAllCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerStatus,
  addCategory,
  deleteCategory,
  createStoreWithLocation
};