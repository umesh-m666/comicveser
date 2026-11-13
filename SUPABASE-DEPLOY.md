# Deploy with Supabase + Render

Database: Supabase Postgres. API: Render (Node, Root Directory `apps/api`). Web: Render (Node, Root Directory `apps/web`).

## 1. Create the Supabase project
1. supabase.com -> New project. Region: US West (closest to Render Oregon). Save the database password.
2. Click **Connect** (top of the project) -> **Session pooler**. Copy the string (port 5432):
   `postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres`
   URL-encode special characters in the password (`@` -> `%40`, `#` -> `%23`).
   Do NOT use the "Direct connection" (IPv6; Render free cannot reach it) or port 6543 (breaks `prisma migrate deploy`).

## 2. Create tables and admin
From `apps/api` on your PC (PowerShell):
```
$env:DATABASE_URL="<SESSION_POOLER_URL>"
npx prisma migrate deploy
$env:SEED_ADMIN_EMAIL="you@example.com"
$env:SEED_ADMIN_PASSWORD="a-strong-password"
npx tsx prisma/create-admin.ts
npx tsx prisma/seed.ts
```
## 3. (Optional) copy your local data instead of seeding
```
docker exec -t <db-container> pg_dump -U comicverse --clean --if-exists --no-owner --no-acl comicverse > dump.sql
psql "<SESSION_POOLER_URL>" -f dump.sql
```
Then run `create-admin.ts` again (step 2) so the admin password matches.

## 4. Lock down Supabase's public API
Supabase Settings -> API -> disable the Data API, or run `supabase-rls.sql` in the SQL Editor.

## 5. Render API service (Environment)
`DATABASE_URL` = Session pooler URL, plus NODE_VERSION=20, NODE_ENV=production, WEB_ORIGIN, TRUST_PROXY=1,
API_PUBLIC_URL, S3_*, MAIL_PROVIDER (+ RESEND_API_KEY, MAIL_FROM). Redeploy.

## 6. Render web service
`NEXT_PUBLIC_API_URL` = https://<api-host>/api, then Clear build cache & deploy.

## Local front-end work when your network blocks port 5432
Some networks block outbound Postgres ports, so your PC cannot reach Supabase. HTTPS is not blocked, so run the web app locally against the live API:
1. Render API service -> Environment -> `WEB_ORIGIN` = `https://<your-web>.onrender.com,http://localhost:3001` (comma-separated), then redeploy.
2. `apps/web/.env.local` -> `NEXT_PUBLIC_API_URL=https://<your-api>.onrender.com/api`
3. `cd apps/web && npx next dev -p 3001`
(Running the API itself locally still needs to reach Supabase: use a hotspot/VPN, or Docker Postgres.)
