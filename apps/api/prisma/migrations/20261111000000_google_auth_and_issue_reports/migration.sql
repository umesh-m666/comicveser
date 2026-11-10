-- Google OAuth & Issue Reporting Enhancements (idempotent, preserves all existing rows)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'local';
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");

ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "subject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "comicId" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "chapterId" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "adminResponse" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "respondedById" TEXT;

CREATE INDEX IF NOT EXISTS "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "Report_isRead_status_createdAt_idx" ON "Report"("isRead", "status", "createdAt");
