# ComicVerse Monorepo

Next.js web app (`apps/web`), NestJS API (`apps/api`, PostgreSQL via Prisma) and the manga source service (`manga-novel-api`).
Deployed on Render. See `AUTH-ACCOUNT-FIX.md` for the authentication / Account / Admin Panel fix.

## Install, configure, run

Prerequisites: Node 20+, PostgreSQL.

```bash
# 1. API
cd apps/api
cp .env.example .env            # set DATABASE_URL, WEB_ORIGIN=http://localhost:3000, ADMIN_API_KEY, etc.
npm install
npx prisma migrate deploy       # applies the existing migrations (no new migration was needed for this fix)
npm run db:seed                 # roles + permissions (+ first admin if SEED_ADMIN_EMAIL / password are set)
npm run start:dev               # API on http://localhost:4000/api

# 2. Web (second terminal)
cd apps/web
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm install
npm run dev                     # http://localhost:3000
```

Make an admin without touching other users: `cd apps/api && npm run db:create-admin` (see `prisma/create-admin.ts`).

## Tests and builds

```bash
cd apps/api && npm test && npm run build && npm run test:e2e   # e2e needs a *test* database (see .env.test.example)
cd apps/web && npm run typecheck && npm run build
cd apps/web && npm run test:e2e   # Playwright; API must be running against the test DB, seeded with prisma/seed-e2e.ts
```
