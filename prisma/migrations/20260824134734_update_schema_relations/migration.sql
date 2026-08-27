/*
  Warnings:

  - You are about to drop the column `category` on the `Store` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Store` table. All the data in the column will be lost.
  - You are about to drop the `Story` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `categoryId` to the `Store` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityId` to the `Store` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Store` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Store" DROP CONSTRAINT "Store_userId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_storeId_fkey";

-- AlterTable
ALTER TABLE "Store" DROP COLUMN "category",
DROP COLUMN "city",
ADD COLUMN     "categoryId" INTEGER NOT NULL,
ADD COLUMN     "cityId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "tokenExpiry" TIMESTAMP(3);

-- DropTable
DROP TABLE "Story";

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
