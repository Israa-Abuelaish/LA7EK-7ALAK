# La7ek 7alak (لحّق حالك) 🚀

منصة تفاعلية تتيح للمستخدمين استعراض المتاجر، العروض والقصص اليومية (Stories) التي تنتهي خلال 24 ساعة، مع لوحة تحكم متكاملة للأدمن والتجار والزبائن.

## 🛠 التقنيات المستخدمة (Tech Stack)

- **Backend:** Node.js, Express.js
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Authentication:** JWT, bcryptjs
- **Hosting:** Railway (Backend & DB), Vercel (Frontend)

---

## 📂 هيكلية المشروع (Project Structure)

```text
📦 La7ek-7alak-Backend
 ┣ 📂 config          # إعدادات الاتصال بقاعدة البيانات
 ┣ 📂 routes          # مسارات الـ APIs (المصادقة، المتاجر، الستوريات، الأدمن)
 ┣ 📂 prisma          # ملفات هيكلية قاعدة البيانات (Schema)
 ┗ 📜 server.js       # نقطة البداية وتشغيل السيرفر
```
