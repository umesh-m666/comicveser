# ComicVerse Monorepo

Next.js web app (`apps/web`), NestJS API (`apps/api`, PostgreSQL via Prisma) and the manga source service (`manga-novel-api`).
Deployed on Render. See `AUTH-ACCOUNT-FIX.md` for the authentication / Account / Admin Panel fix and `REDESIGN-V2-NOTES.md` for the latest navigation / reader / bookmarks redesign.

## Install, configure, run

Prerequisites: Node 20+, PostgreSQL.

```bash
# 1. API
cd apps/api
cp .env.example .env            # set DATABASE_URL, WEB_ORIGIN=http://localhost:3000, ADMIN_API_KEY, etc.
npm install
npx prisma migrate deploy       # applies all migrations, incl. 20261110120000_reading_state (read-chapter tracking + bookmark shelves)
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
1. Find your PostgreSQL tools

In PowerShell:

Get-Service *postgres*
Get-ChildItem "C:\Program Files\PostgreSQL"
The first command should show a service with status Running. If it’s Stopped, start it with Start-Service <name>.
The second shows a version folder, such as 16 or 17. Use that number in the paths below.

If the second command says the folder doesn’t exist, tell me what the first command printed. In that case I’ll suggest another way, which is publishing the comics again from the live admin panel.

2. Dump your local database

Replace 16 with your version. The command asks for the comicverse user’s password, which is the one in your original apps/api/.env (the old DATABASE_URL).

cd C:\Users\LenoVo\Desktop\umesh\comicverse
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -h localhost -U comicverse --clean --if-exists --no-owner --no-acl -f dump.sql comicverse

Use -f dump.sql and not >. Redirecting in PowerShell saves the file in the wrong encoding and breaks the restore. Open dump.sql in Notepad, and check that it starts with -- PostgreSQL database dump and is not empty.

3. Load it into Supabase

Do this on the hotspot, after the Test-NetConnection ... -Port 5432 test says True. This replaces everything in Supabase, including users. Put your real Session pooler URL in single quotes:

& "C:\Program Files\PostgreSQL\16\bin\psql.exe" 'postgresql://postgres.mganubxkeqyecnwxkiuk:NEWPASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres' -f dump.sql

You’ll see many DROP, CREATE and COPY lines. A few “does not exist, skipping” notices are normal. If it stops with an error like unrecognized configuration parameter, send it to me, because that means a version mismatch I can work around.

4. After the restore
Reset the admin (the restore brings back your old local users):
   cd apps\api
   Remove-Item Env:SEED_ADMIN_EMAIL, Env:SEED_ADMIN_PASSWORD -ErrorAction SilentlyContinue
   npx tsx --env-file=.env prisma/create-admin.ts
   
Run  in the Supabase SQL Editor again.

   DO $$ DECLARE r record; BEGIN
     FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
       EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
     END LOOP;
   END $$;

Add the SOURCES_* variables to the Render API service (the list from my last message), then redeploy.
Restart your local API, and check that the comics appear on localhost:3001 and on the live site.

If a step prints an error, paste it with passwords hidden and tell me the step number.
