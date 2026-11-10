-- IDEMPOTENT_MIGRATION
-- External sources (MangaDex): admin source settings and readers' saved titles.
-- Additive only: two new tables. No existing table is altered or dropped.

-- CreateTable
CREATE TABLE IF NOT EXISTS "SourceSetting" (
    "sourceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceSetting_pkey" PRIMARY KEY ("sourceId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExternalLibraryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExternalLibraryEntry_userId_createdAt_idx" ON "ExternalLibraryEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExternalLibraryEntry_sourceId_externalId_idx" ON "ExternalLibraryEntry"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalLibraryEntry_userId_sourceId_externalId_key" ON "ExternalLibraryEntry"("userId", "sourceId", "externalId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ExternalLibraryEntry" ADD CONSTRAINT "ExternalLibraryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
