/*
  Warnings:

  - A unique constraint covering the columns `[providerOrderId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `planCode` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerOrderId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "planCode" TEXT NOT NULL,
ADD COLUMN     "providerOrderId" TEXT NOT NULL,
ALTER COLUMN "providerPaymentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "comicId" TEXT,
    "chapterId" TEXT,
    "path" TEXT,
    "query" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_comicId_idx" ON "AnalyticsEvent"("comicId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerOrderId_key" ON "Payment"("providerOrderId");
