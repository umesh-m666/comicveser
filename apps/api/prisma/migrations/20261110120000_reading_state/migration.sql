-- IDEMPOTENT_MIGRATION
-- Reading state: per-chapter "read" tracking and optional manual bookmark shelves.
-- Additive and idempotent: existing bookmarks, history and users are preserved.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookmarkStatus') THEN
        CREATE TYPE "BookmarkStatus" AS ENUM ('READING', 'COMPLETED', 'PLAN_TO_READ', 'ON_HOLD', 'DROPPED');
    END IF;
END $$;

-- NULL = automatic status (derived from reading progress), so existing bookmarks keep behaving sensibly.
ALTER TABLE "Bookmark" ADD COLUMN IF NOT EXISTS "status" "BookmarkStatus";
ALTER TABLE "Bookmark" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Bookmark_userId_status_idx" ON "Bookmark"("userId", "status");

CREATE TABLE IF NOT EXISTS "ChapterRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comicId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChapterRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChapterRead_userId_chapterId_key" ON "ChapterRead"("userId", "chapterId");
CREATE INDEX IF NOT EXISTS "ChapterRead_userId_comicId_idx" ON "ChapterRead"("userId", "comicId");
CREATE INDEX IF NOT EXISTS "ChapterRead_userId_readAt_idx" ON "ChapterRead"("userId", "readAt");

DO $$ BEGIN
    ALTER TABLE "ChapterRead" ADD CONSTRAINT "ChapterRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "ChapterRead" ADD CONSTRAINT "ChapterRead_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "ChapterRead" ADD CONSTRAINT "ChapterRead_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill from existing reading history: the app already treated every chapter numbered below the reader's
-- current chapter as "read", so keep that behaviour. The chapter a reader is currently on stays "in progress".
INSERT INTO "ChapterRead" ("id", "userId", "comicId", "chapterId", "readAt")
SELECT gen_random_uuid()::text, h."userId", h."comicId", c."id", h."updatedAt"
FROM "ReadingHistory" h
JOIN "Chapter" cur ON cur."id" = h."chapterId"
JOIN "Chapter" c ON c."comicId" = h."comicId" AND c."number" < cur."number"
WHERE c."publishState" = 'PUBLISHED' AND c."deletedAt" IS NULL
ON CONFLICT ("userId", "chapterId") DO NOTHING;
