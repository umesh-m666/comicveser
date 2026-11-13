-- Additive migration for automatic chapter synchronization, original chapter labels, and structured notification metadata
ALTER TABLE "SourceTitle" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "SourceTitle" ADD COLUMN IF NOT EXISTS "lastSyncStatus" TEXT;
ALTER TABLE "SourceTitle" ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT;

ALTER TABLE "SourceChapter" ADD COLUMN IF NOT EXISTS "originalLabel" TEXT;

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "meta" JSONB;
