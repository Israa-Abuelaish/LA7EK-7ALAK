const { PrismaClient } = require('@prisma/client');

// نمط Singleton لمنع إنشاء اتصالات متعددة لقاعدة البيانات أثناء التطوير (Hot Reloading)
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();



if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
module.exports = prisma;