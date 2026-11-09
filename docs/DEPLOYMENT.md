# Deployment guide

## Environments
| | Development | Staging | Production |
|---|---|---|---|
| Web | `npm run dev` on :3000 | Vercel preview/branch | Vercel production |
| API | `npm run start:dev` on :4000 | Container on Render/Railway/Fly (own service) | Same, separate service |
| Database | local Postgres | separate managed DB | managed Postgres with backups |
| Storage | any bucket or none | separate bucket | R2/S3 bucket + custom domain |
| Mail | printed to console | real provider, test sender | real provider |
| Payments | off | Razorpay **test** keys | off until launched |

Never share a database or bucket between environments. Tests must only ever use a database whose name contains `test`.

## One-time setup
1. **Database.** Create managed Postgres. Run `npx prisma migrate deploy` (see below). Apply `docs/sql/search-indexes.sql` as a migration (instructions inside the file).
2. **Storage.** Create a bucket. Add a CORS rule: allowed origin = your web URL, methods `PUT, GET, HEAD`, headers `*`. On R2, connect a custom domain (`cdn.example.com`) and set `CDN_BASE_URL` to it. Add a Cloudflare cache rule for that host: cache everything, edge and browser TTL 1 year (file names are unique, so this is safe). Add hotlink protection if wanted.
3. **Email.** Verify your sending domain with Resend (SPF/DKIM). Set `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM`.
4. **API service.** Deploy `apps/api` using its `Dockerfile`. Set the variables below. Health check path: `/api/health`.
5. **Web.** Import `apps/web` in Vercel (root directory `apps/web`). Set `NEXT_PUBLIC_API_URL=https://api.example.com/api`, `NEXT_PUBLIC_CDN_ORIGIN`, `NEXT_PUBLIC_EXTRA_CONNECT` (your bucket origin, needed for browser uploads).
6. **Domains.** `example.com` (web) and `api.example.com` (API) on Cloudflare DNS. HTTPS is automatic on Vercel and most container hosts; turn on "Always use HTTPS" and HSTS. Keep both on the same registrable domain and set `COOKIE_DOMAIN=.example.com` so the login cookie reaches the API.
7. **First admin.** Open a one-off shell on the API with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` set and run `npx tsx prisma/create-admin.ts` (the repair script from earlier), then remove those variables.

## API environment variables
| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `DATABASE_URL` | yes | managed Postgres, with `?sslmode=require` if the host needs it |
| `WEB_ORIGIN` | yes | `https://example.com` (must be https) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | yes | key scoped to this bucket only |
| `CDN_BASE_URL` | recommended | otherwise signed URLs are used |
| `MAIL_PROVIDER`, `RESEND_API_KEY`, `MAIL_FROM` | yes | |
| `TRUST_PROXY` | yes behind a proxy | usually `1` |
| `COOKIE_DOMAIN` | if app/api are subdomains | `.example.com` |
| `REDIS_URL` | recommended | cache; falls back to memory |
| `DISABLE_JOBS` | optional | `true` on extra replicas |
| `PAYMENTS_ENABLED` + `RAZORPAY_*` | optional | leave unset to keep payments off |

## Release process
1. Open a pull request. CI runs type-check, build, unit tests, API integration tests, web build and browser tests.
2. Merge to `main`. Vercel deploys the web app.
3. Deploy the API image, then run the **release step** once: `npx prisma migrate deploy`. Do not run migrations from every replica at start-up.
4. Check `/api/health`, then log in and open a comic.
5. **Rollback:** redeploy the previous image or Vercel deployment. Migrations are forward-only: write a new migration to undo schema changes, and deploy additive migrations first (add columns, deploy code, remove later).

## Backups
- Turn on the database host's automated backups with point-in-time recovery (at least 7 days).
- Add a daily `pg_dump` to separate storage as a second copy.
- Enable object versioning on the bucket. Page images are the hard-to-recreate asset.
- **Test a restore into a scratch database before launch and every quarter.** An untested backup is not a backup.

## Monitoring
- Uptime monitor on `https://api.example.com/api/health` and on the home page, alerting by email or SMS.
- Host log retention and alerts for repeated 5xx responses and for "Missing or invalid production settings" at start-up.
- Optional later: Sentry for error tracking (not integrated), database size and connection alerts, bucket spend alerts.

## Performance checklist
- Verified in code: indexes on the hot query paths, pagination everywhere, lazy image batches, gzip, 60-second cache for trending/latest/popular, page caching on the web app.
- To do on real data: apply the trigram indexes; run Lighthouse on the home, comic and reader pages with a throttled mobile profile; check slow queries (`pg_stat_statements`) after a week of traffic.
- **Nothing here has been measured.** Treat the numbers as unknown until you measure.
