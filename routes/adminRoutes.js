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

// 2. الأدمن يضيف مستخدم جديد (سواء تاجر مع متجره أو زبون)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, phone, storeData } = req.body; // استقبال الـ phone

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني موجود مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let userData = {
      name,
      email,
      password: hashedPassword,
      phone, 
      role: role || 'merchant'
    };

    if (role === 'merchant') {
      userData.merchantProfile = {
        create: {
          storeName: storeData.storeName,
          commercialNo: storeData.commercialNo,
          wallet: { create: { balance: 0.0 } }
        }
      };
    }

    const newUser = await prisma.user.create({
      data: userData,
      include: { merchantProfile: true, customerProfile: true }
    });

    if (role === 'merchant' && storeData && newUser.merchantProfile) {
      await prisma.store.create({
        data: {
          name: storeData.storeName,
          description: storeData.description,
          userId: newUser.id,
          categoryId: parseInt(storeData.categoryId),
          cityId: parseInt(storeData.cityId)
        }
      });
    }

    res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح بواسطة الأدمن', newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 3. حذف تاجر أو زبون
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // التصحيح هنا: تمرير المتغير userId مباشرة بالطريقة الصحيحة لـ Prisma
    const user = await prisma.user.findUnique({
      where: { id: userId }, 
      include: { 
        merchantProfile: true, 
        customerProfile: true 
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ message: 'تم حذف المستخدم وجميع البيانات المرتبطة به بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. إضافة تصنيف جديد
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

// 5. حذف تصنيف
router.delete('/categories/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    await prisma.category.delete({ where: { id: categoryId } });
    res.json({ message: 'تم حذف التصنيف بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'لا يمكن حذف التصنيف لوجود متاجر مرتبطة به' });
  }
});

// 6. جلب جميع المستخدمين للتطبيق والداشبورد
router.get('/users', async (req, res) => {
  try {
    // جلب العدد الإجمالي للمستخدمين
    const totalUsers = await prisma.user.count();

    // جلب قائمة جميع المستخدمين مع بياناتهم الشخصية
    const users = await prisma.user.findMany({
      include: { 
        customerProfile: true, 
        merchantProfile: true 
      },
      orderBy: { createdAt: 'desc' } 
    });

    res.json({
      count: totalUsers,
      users: users
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;