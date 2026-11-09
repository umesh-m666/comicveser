-- Speeds up the case-insensitive "contains" search on titles, authors and artists.
-- Apply as a Prisma migration so migrations stay in sync:
--   npx prisma migrate dev --create-only --name search_indexes
--   (paste this file into the generated migration.sql, then)  npx prisma migrate dev
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS comic_title_trgm  ON "Comic" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS comic_alt_trgm    ON "Comic" USING gin ("altTitle" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS comic_author_trgm ON "Comic" USING gin (author gin_trgm_ops);
CREATE INDEX IF NOT EXISTS comic_artist_trgm ON "Comic" USING gin (artist gin_trgm_ops);
CREATE INDEX IF NOT EXISTS novel_title_trgm  ON "Novel" USING gin (title gin_trgm_ops);
