-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "transactionId" TEXT;
