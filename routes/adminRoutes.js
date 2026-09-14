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
// router.post('/users', async (req, res) => {
//   try {
//     const { name, email, password, role, phone, storeData } = req.body; // استقبال الـ phone

//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (existingUser) {
//       return res.status(400).json({ error: 'البريد الإلكتروني موجود مسبقاً' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     let userData = {
//       name,
//       email,
//       password: hashedPassword,
//       phone, 
//       role: role || 'merchant'
//     };

//     if (role === 'merchant') {
//       userData.merchantProfile = {
//         create: {
//           storeName: storeData.storeName,
//           commercialNo: storeData.commercialNo,
//           wallet: { create: { balance: 0.0 } }
//         }
//       };
//     }

//     const newUser = await prisma.user.create({
//       data: userData,
//       include: { merchantProfile: true, customerProfile: true }
//     });

//     if (role === 'merchant' && storeData && newUser.merchantProfile) {
//       await prisma.store.create({
//         data: {
//           name: storeData.storeName,
//           description: storeData.description,
//           userId: newUser.id,
//           categoryId: parseInt(storeData.categoryId),
//           cityId: parseInt(storeData.cityId)
//         }
//       });
//     }

//     res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح بواسطة الأدمن', newUser });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });




// قم بتغيير /users إلى /merchants أو أضفه بالشكل التالي:
router.post('/merchants', async (req, res) => {
  try {
    // استلام البيانات المرسلة من ملف merchantForm.jsx
    const { fullName, email, password, storeName, phone, categoryId, cityId } = req.body; 

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني موجود مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let userData = {
      name: fullName, // مطابقة لـ fullName المرسلة من الفرونت
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

// 7. تعديل بيانات التاجر والمتجر
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

//8. تغيير حالة التاجر (نشط أو غير نشط)
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

module.exports = router;