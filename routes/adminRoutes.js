const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

// 1. لوحة تحكم الأدمن (الإحصائيات)
router.get('/dashboard-stats', async (req, res) => {
  try {
    const storesCount = await prisma.store.count();
    const customersCount = await prisma.user.count({ where: { role: 'customer' } });
    const merchantsCount = await prisma.user.count({ where: { role: 'merchant' } });
    const storiesCount = await prisma.story.count({ where: { status: 'active' } });

    res.json({
      storesCount,
      customersCount,
      merchantsCount,
      storiesCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
//=================== مسارات إدارة التجار الحقيقية عبر  ====================
// 2. الأدمن يضيف تاجر جديد
router.post('/merchants', async (req, res) => {
  try {
    const { fullName, email, password, storeName, phone, categoryId, cityId } = req.body; 

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني موجود مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let userData = {
      name: fullName,
      email,
      password: hashedPassword,
      phone, 
      role: 'merchant'
    };

    userData.merchantProfile = {
      create: {
        storeName: storeName,
        wallet: { create: { balance: 0.0 } }
      }
    };

    const newUser = await prisma.user.create({
      data: userData,
      include: { merchantProfile: true }
    });

    // إنشاء المتجر بالبيانات المرسلة (categoryId و cityId)
    if (newUser.merchantProfile) {
      await prisma.store.create({
        data: {
          name: storeName,
          userId: newUser.id,
          categoryId: parseInt(categoryId),
          cityId: parseInt(cityId)
        }
      });
    }

    res.status(201).json({ message: 'تم إنشاء حساب التاجر بنجاح', merchant: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 3. جلب جميع المستخدمين للتطبيق
router.get('/merchants', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'merchant' },
      include: {
        merchantProfile: true,
        Store: { 
          include: {
            city: true,     
            category: true  
          }
        }
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

    res.json({
      count: formattedUsers.length,
      users: formattedUsers
    });
  } catch (error) {
    console.error("خطأ في جلب المستخدمين:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. تعديل بيانات التاجر والمتجر
router.put('/merchants/:id', async (req, res) => {
  try {
    const merchantId = Number(req.params.id);
    const { storeName, name, phone, cityId, categoryId } = req.body;

    // 1. تحديث جدول المستخدم الأساسي (User)
    const updatedUser = await prisma.user.update({
      where: { id: merchantId },
      data: {
        name: name,
        phone: phone,
      }
    });

    const existingStore = await prisma.store.findFirst({
      where: { userId: merchantId }
    });

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
      // إن لم يكن له متجر مسبقاً، نقوم بإنشائه
      await prisma.store.create({
        data: {
          name: storeName,
          userId: merchantId,
          cityId: Number(cityId),
          categoryId: Number(categoryId)
        }
      });
    }

    res.json({ message: 'تم تحديث بيانات التاجر والمتجر بنجاح', user: updatedUser });
  } catch (error) {
    console.error("خطأ في التعديل:", error);
    res.status(500).json({ message: error.message || 'حدث خطأ أثناء تعديل بيانات التاجر' });
  }
});

//5. تغيير حالة التاجر (نشط أو غير نشط)
router.patch('/merchants/:id/status', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { status } = req.body; 

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: status }
    });

    res.json({ message: 'تم تحديث حالة التاجر بنجاح', user: updatedUser });
  } catch (error) {
    console.error("خطأ في تغيير الحالة:", error);
    res.status(500).json({ message: error.message || 'حدث خطأ أثناء تغيير الحالة' });
  }
});












// ==================== مسارات إدارة الزبائن الحقيقية عبر API ====================

// 7. جلب قائمة الزبائن
router.get('/customers', async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'customer' },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message || 'فشل جلب قائمة الزبائن' });
  }
});

// 8. إضافة زبون جديد
router.post('/customers', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'اسم الزبون مطلوب' });
    }

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

    res.status(201).json({ message: 'تم إضافة الزبون بنجاح', customer: newCustomer });
  } catch (error) {
    console.error('Error adding customer:', error);

    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً، يرجى استخدام بريد آخر.' });
    }

    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إضافة الزبون' });
  }
});

// 9. تعديل بيانات الزبون
router.put('/customers/:id', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const { name, email, phone } = req.body;

    const updatedCustomer = await prisma.user.update({
      where: { id: customerId },
      data: { name, email, phone }
    });

    res.status(200).json({ message: 'تم تعديل بيانات الزبون بنجاح', customer: updatedCustomer });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: error.message || 'فشل تحديث بيانات الزبون' });
  }
});

// 4. حذف الزبون
router.delete('/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id; // بدون parseInt إذا كان النص/UUID
    console.log("Deleting customer with ID:", customerId);

    await prisma.user.delete({
      where: {
        id: customerId 
      },
    });

    res.status(200).json({ message: 'تم حذف الزبون بنجاح' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: error.message || 'فشل حذف الزبون' });
  }
});


// 10. تغيير حالة الحساب (نشط / محظور)
router.patch('/customers/:id/status', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const { status } = req.body; // 'active' أو 'banned'

    const updatedCustomer = await prisma.user.update({
      where: { id: customerId },
      data: { status }
    });

    res.status(200).json({ message: 'تم تغيير حالة الزبون بنجاح', customer: updatedCustomer });
  } catch (error) {
    console.error('Error changing customer status:', error);
    res.status(500).json({ error: error.message || 'فشل تغيير حالة الحساب' });
  }
});



//=================== مسارات إدارة التصنيفات الحقيقية عبر API ====================
// 11. إضافة تصنيف جديد
router.post('/categories', async (req, res) => {
  try {
    const { name, icon } = req.body;

    // 1. البحث عما إذا كان التصنيف موجوداً مسبقاً بالاسم
    let category = await prisma.category.findUnique({
      where: { name: name }
    });

    if (category) {
      // إذا كان موجوداً، نقوم بتحديث الأيقونة أو الاسم إن أردت
      category = await prisma.category.update({
        where: { id: category.id },
        data: { icon: icon || category.icon }
      });
      return res.json({ message: 'التصنيف موجود مسبقاً، تم تحديثه بنجاح', category });
    }

    // 2. إذا لم يكن موجوداً، نقوم بإنشائه جديداً
    category = await prisma.category.create({
      data: { name, icon }
    });

    res.status(201).json({ message: 'تم إضافة التصنيف بنجاح', category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 12. حذف تصنيف
router.delete('/categories/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    await prisma.category.delete({ where: { id: categoryId } });
    res.json({ message: 'تم حذف التصنيف بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'لا يمكن حذف التصنيف لوجود متاجر مرتبطة به' });
  }
});

module.exports = router;
