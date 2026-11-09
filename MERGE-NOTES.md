# Merge notes: Phase 9 added to your project

Your files were kept as they were: the UI redesign (globals.css, layout, Nav, ComicCard, home page, admin layout),
the cover/banner upload work (ComicForm, ChapterManager, comics controller/service/dto/module, creator service),
the ZIP file-count fix, `prisma/create-admin.ts`, your migrations, lockfiles and the two guide files.

## Added from Phase 9
- Reader: Paged and Paged (right to left) modes, zoom, arrow keys, tap zones, swipe, preloading, remembered settings
- Pages: About, Contact, Privacy, Terms, Copyright policy (drafts, need legal review; fill the NEXT_PUBLIC_* values in apps/web/.env.local)
- Profile: Settings (username, bio, password, notifications, delete account), My reviews, shared profile navigation, /profile redirect
- Report button on comic pages
- API: GET /user/reviews, DELETE /user/account; tests for account deletion; Playwright reader-mode tests

## Changed while merging
- Covers you upload are now returned by the API as `coverUrl` and shown on comic cards, the home hero and the comic page (your gradient remains the fallback). Banner images are stored but not shown anywhere yet.
- admin.controller.ts: replaced the `Express.Multer.File` type, which caused a compile error.
- apps/web/src/css.d.ts: lets TypeScript 5.9 accept the global stylesheet import.

## Checked
- `tsc --noEmit` passes for apps/api and apps/web using your installed node_modules.
- The 13 unit tests pass.
- NOT run: database integration tests, browser tests, `next build` (need Postgres and Windows tooling).

## Left as it was
- apps/api/src/common/admin-key.guard.ts is unused (nothing imports it). It is safe to delete.

## To apply
No new packages and no database migration are needed. Copy this folder over your project (your .env files were not included, so they stay as they are), then restart the API and web app.

---
# Update: external sources (MangaDex)
Added `apps/api/src/sources/*`, `docs/EXTERNAL-SOURCES.md`, the `/sources` pages, `/admin/sources`, `/profile/external-library`, tests, and two Prisma models.
Edited existing files only where needed: `Reader.tsx` (external chapters), `Nav.tsx`, `ProfileNav.tsx`, `admin/layout.tsx` (links), `app.module.ts`, `schema.prisma`, `user.service.ts` (account deletion also clears saved titles), both `package.json` test scripts, `.env.example`.
Your `.env` files were not touched. Migration `20261106120000_external_sources` is included; run `npx prisma migrate dev` in apps/api (stop the API first on Windows).

## Follow-up: tests and docs
- Removed `apps/api/src/sources/providers/`, an earlier draft that called the scraper repo and was no longer used.
- Added the migration above (hand-written, not yet run against a database).
- Expanded `docs/EXTERNAL-SOURCES.md` (connection test, settings table, troubleshooting) and the README section.

## Fix: local chapter uploads restored
An earlier zip had reverted the local-upload work. Restored from your project: `storage.service.ts`, `chapters.module.ts`, `main.ts`, `ChapterManager.tsx`, `UPLOAD-SETUP.md`, and `storage.local.test.ts` is back in the API `npm test` script.
