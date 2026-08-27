-- CreateTable
CREATE TABLE "Story" (
    "id" SERIAL NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "caption" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeId" INTEGER NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
