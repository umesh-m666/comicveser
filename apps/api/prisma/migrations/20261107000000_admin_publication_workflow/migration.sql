-- Admin-controlled external title publication. Existing comics and progress are untouched.
CREATE TYPE "SourceTitleState" AS ENUM ('APPROVED', 'REJECTED', 'UNPUBLISHED');

ALTER TABLE "Comic" ADD COLUMN "externalCoverUrl" TEXT;

CREATE TABLE "SourceTitle" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "coverUrl" TEXT,
    "contentType" TEXT NOT NULL,
    "state" "SourceTitleState" NOT NULL,
    "comicId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SourceTitle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceChapter" (
    "id" TEXT NOT NULL,
    "sourceTitleId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "numberLabel" TEXT,
    "title" TEXT,
    "volume" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "language" TEXT,
    "publishedAt" TIMESTAMP(3),
    "pageCount" INTEGER,
    "groups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "SourceChapter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceTitle_comicId_key" ON "SourceTitle"("comicId");
CREATE UNIQUE INDEX "SourceTitle_sourceId_externalId_key" ON "SourceTitle"("sourceId", "externalId");
CREATE INDEX "SourceTitle_state_updatedAt_idx" ON "SourceTitle"("state", "updatedAt");
CREATE UNIQUE INDEX "SourceChapter_chapterId_key" ON "SourceChapter"("chapterId");
CREATE UNIQUE INDEX "SourceChapter_sourceTitleId_externalId_key" ON "SourceChapter"("sourceTitleId", "externalId");
CREATE INDEX "SourceChapter_sourceTitleId_chapterId_idx" ON "SourceChapter"("sourceTitleId", "chapterId");

ALTER TABLE "SourceTitle" ADD CONSTRAINT "SourceTitle_comicId_fkey"
    FOREIGN KEY ("comicId") REFERENCES "Comic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceTitle" ADD CONSTRAINT "SourceTitle_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceChapter" ADD CONSTRAINT "SourceChapter_sourceTitleId_fkey"
    FOREIGN KEY ("sourceTitleId") REFERENCES "SourceTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceChapter" ADD CONSTRAINT "SourceChapter_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
