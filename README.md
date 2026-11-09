# ComicVerse

Original digital comics platform (manga, manhwa, manhua, webtoon, novels).
Monorepo: `apps/web` (Next.js) now; `apps/api` (NestJS + Prisma + PostgreSQL) arrives in Phase 2.

Only fictional sample content is used. No third-party code, logos or artwork are copied.

## Run Phase 1
```bash
cd apps/web
npm install
npm run dev     # http://localhost:3000
npm run build   # production build check
npm run typecheck
```
Requires Node 20+. Phase 1 reads from `src/lib/comics.ts`, a data-access layer backed by fictional sample data; Phase 2 replaces its internals with the REST API without touching pages.

See `docs/ARCHITECTURE.md` for architecture and the full checklist.

## Run the API (Phase 2)
```bash
docker compose up -d                # Postgres + Redis
cd apps/api && cp .env.example .env # set ADMIN_API_KEY (16+ chars)
npm install
npx prisma migrate dev --name init  # creates tables
npm run db:seed
npm run start:dev                   # http://localhost:4000/api, docs at /api/docs
```
Set `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` in `.env` before `db:seed` to create the first admin, then `POST /api/auth/login`. In dev, verification and reset links are printed in the API console. Run `npx prisma migrate dev --name auth` after pulling Phase 3 (new Session/AuthToken tables).

## Phase 4 setup
- Web: `apps/web/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:4000/api`; run API and web together.
- Storage: fill the `S3_*` vars. The bucket needs a CORS rule allowing `PUT` from your web origin, otherwise browser uploads fail.
- Production cookies: serve web and API on the same registrable domain (e.g. `app.example.com` and `api.example.com`) so the SameSite=Lax session cookie is sent.
- Upload flow: `POST /api/admin/chapters` -> `POST /api/admin/uploads` (get signed URL) -> `PUT` file to it -> `POST /api/admin/chapters/:id/images` -> `PUT /api/admin/chapters/:id` with `{"publishState":"PUBLISHED"}`.

## Phase 6 setup
Schema changed (review votes, notification links). From `apps/api` run `npm install` then `npx prisma migrate dev --name phase6`.
Creator flow: user applies at `/creator/dashboard` -> admin approves at `/admin/creators` -> creator submits a comic (PENDING) and chapters -> admin publishes from `/admin/comics` and `/admin/chapters`.

## Phase 7 setup
From `apps/api`: `npm install`, then `npx prisma migrate dev --name phase7` (Payment gets order/plan fields; new AnalyticsEvent table), then restart.
Payments stay off until `.env` has `PAYMENTS_ENABLED=true` plus Razorpay **test** keys. In the Razorpay dashboard add a webhook to `https://<public-url>/api/billing/webhook` with the secret in `RAZORPAY_WEBHOOK_SECRET` and events `payment.captured`, `payment.failed`, `refund.processed`. For local work expose port 4000 with a tunnel such as ngrok.
Analytics only records after a visitor accepts the banner.

## Testing (Phase 8)
**Unit tests** (no database needed): `cd apps/api && npm install && npm test`.

**API integration tests** (use a throwaway database; they refuse any database whose name lacks "test"):
```bash
createdb comicverse_test            # or CREATE DATABASE comicverse_test OWNER comicverse; in psql
cd apps/api && cp .env.test.example .env.test
npx dotenv-cli -e .env.test -- npx prisma migrate deploy   # or set DATABASE_URL in your shell and run: npx prisma migrate deploy
npm run test:e2e
```
**Browser tests** (Playwright):
```bash
cd apps/api && npm run seed:e2e && npm run build && node dist/main.js    # with .env.test values loaded (CDN_BASE_URL=http://e2e.invalid)
cd apps/web && npm install && npm run test:e2e:install && npm run test:e2e
```
The reader test replaces page images with a 1x1 PNG, so no storage is needed. The upload test runs only with `E2E_S3=1`.

Security notes: `docs/SECURITY.md`. Deployment: `docs/DEPLOYMENT.md`.

## External sources (WeebCentral, Asura Scans, and ComicK)
Optional and off by default. Administrators can search the enabled catalogs, review titles, and approve publication; chapter images are loaded from provider URLs and are not stored by ComicVerse. Full setup, source limitations, authorization requirements, and tests are documented in `docs/EXTERNAL-SOURCES.md`.
