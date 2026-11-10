-- IDEMPOTENT_MIGRATION
-- Allow a Comic to have a PRIMARY SourceTitle (e.g. ComicK) and CHAPTER_FALLBACK SourceTitles (WeebCentral, Asura Scans).
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SourceTitleRole') THEN
        CREATE TYPE "SourceTitleRole" AS ENUM ('PRIMARY', 'CHAPTER_FALLBACK');
    END IF;
END $$;

DROP INDEX IF EXISTS "SourceTitle_comicId_key";

ALTER TABLE "SourceTitle" ADD COLUMN IF NOT EXISTS "role" "SourceTitleRole" NOT NULL DEFAULT 'PRIMARY';

CREATE UNIQUE INDEX IF NOT EXISTS "SourceTitle_comicId_sourceId_key" ON "SourceTitle"("comicId", "sourceId");
