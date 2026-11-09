# Architecture

```
comicverse/
  apps/web   Next.js 14 App Router, React, TS, Tailwind   (Phase 1)
  apps/api   NestJS REST, Prisma, PostgreSQL, Redis       (Phase 2+)
  docs/
```
Boundaries: pages call `lib/comics.ts` only. That module becomes an API client in Phase 2.
Auth, uploads (R2/S3 signed URLs), jobs (BullMQ), payments (Razorpay webhooks) live in `apps/api`.

# Checklist (status is honest: [x] built, [~] built but not yet run, [ ] not started)

## Phase 1 - Frontend foundation
- [~] Project init, folder structure
- [~] Design tokens as CSS variables (spec palette)
- [~] Desktop header, mobile bottom nav, footer
- [~] Homepage: hero, trending, latest updates, popular (weekly/monthly/all-time), recently added, novels, announcements
- [~] Browse: search, genre/type/status/rating/year filters, sort, pagination, URL params
- [~] Comic detail: metadata, chapter list with sort, start/continue buttons
- [~] Loading, empty, not-found states
- [ ] shadcn/ui, React Hook Form + Zod (needed first in Phase 3 forms)
- [ ] Light theme

## Phase 2 - API foundation
- [~] Prisma schema, all 27 required models, indexes, unique constraints, soft delete fields
- [~] Docker Compose (Postgres 16, Redis 7), env template, seed script
- [~] NestJS: validation, consistent errors, helmet, CORS, throttling, Swagger at /api/docs
- [~] Public: GET /api/comics (filters, sort, pagination), /trending /latest /popular, /:slug, /:id/chapters, /search, /genres
- [~] Admin: comic + genre create/update/delete (soft delete for comics), audit log in same transaction
- [~] Ratings averaged from Rating rows
- [x] Temporary admin key removed in Phase 3
- [ ] Postgres full-text search (currently case-insensitive contains), Redis caching, minRating in SQL
- [ ] Web app still reads sample data; switch to the API next
## Phase 3 - Auth and user data (backend)
- [~] Register/login/logout/me, Argon2id, HTTP-only SameSite=Lax session cookie, sessions stored hashed in DB
- [~] Email verify + forgot/reset password (hashed one-time tokens; reset signs out all devices); dev mail logs links
- [~] Login/register rate limit (5/min), constant-time-ish login, no account enumeration on forgot-password
- [~] RBAC via permissions; comic/genre admin writes now need `comic:write`; audit log records actor id
- [~] CSRF: Origin check on all state-changing requests
- [~] Profile, change password, bookmarks (unique constraint), progress save, history
- [ ] Web forms (login, register, forgot/reset, profile pages) and switching web to the API
- [ ] Real mail provider; avatar upload (Phase 4/5); account deletion; notification settings
## Phase 4 - Chapters, storage, reader
- [~] API: chapter meta (prev/next), images in batches (from/limit), admin chapter create/update/publish, signed upload URLs, image registration, reorder
- [~] Uploads: server-chosen keys, 10 MB cap, magic-byte type check, SHA-256 duplicate rejection, publish blocked with 0 images
- [~] Web wired to API (home, browse, detail); login/register/forgot/reset/verify forms; account link; bookmark button; bookmarks + history pages
- [~] Reader: vertical scroll, batch lazy loading, aspect-ratio placeholders, retry, chapter selector, width modes, fullscreen, progress bar, debounced progress save, restore (server or local)
- [ ] Paged and right-to-left modes, zoom, image preloading, WebP/AVIF variants
- [ ] "Highest rated" sort and minRating in SQL; scheduled-publish job; bucket CORS + hotlink protection
- [ ] Image dimensions are client-reported (layout only); server-side parsing later
- [ ] Dead links remain: /novels, /about, /contact, /privacy, /terms, /copyright-policy, /profile (Phase 6+)
## Phase 5 - Admin
- [~] API: dashboard stats, comic/chapter/user/report/audit/announcement admin endpoints, all permission-checked
- [~] Chapter images: delete, reorder, server-measured dimensions (PNG/JPEG/WebP)
- [~] ZIP import: 100 MB / 300 files / 10 MB each / 400 MB extracted caps, memory-only extraction, unsafe paths rejected, magic-byte type check, natural sort, duplicate rejection, rollback of uploaded objects on failure, never auto-publishes
- [~] Suspending a user deletes their sessions; admins can't suspend themselves
- [~] Admin UI: dashboard, comics (search/filter/publish/delete/create/edit), chapters (create, upload with progress, reorder, delete, publish with confirm), users, genres, announcements, audit logs
- [~] Homepage announcements now come from the API
- [ ] Not built: banners, report/review moderation UI (needs Phase 6 reviews), charts, scheduled publishing job, virus scanning (needs an external scanner), preview of drafts in the real reader, comic cover/banner image upload
- [ ] No automated tests yet
## Phase 6 - Reviews, notifications, novels, creators
- [~] Ratings 1-10 (one per user, average computed), reviews (verified email required, edit/delete, helpful votes once per user), reports, admin moderation page
- [~] Notifications: unread count, mark read/all, new-chapter fan-out to bookmarkers in batches of 500 (respects user setting), creator status notices
- [~] Novels: public list/detail/reader (font size, spacing, width, light/dark), admin create + chapters + publish
- [~] Creator portal: apply, admin approve/reject/suspend (role switches), submit comic with license (starts PENDING), chapters with ownership checks, upload, submit for review
- [ ] Notification fan-out runs in-process; move to a queue (BullMQ/Redis) for large audiences
- [ ] Not built: comments, review replies and reply notifications, email/push notifications, novel bookmarks/progress, creator analytics and revenue, "request modifications" notes, creator ZIP upload, banners
- [ ] Dead links remain: /about, /contact, /privacy, /terms, /copyright-policy, /profile (settings)
## Phase 7 - Payments, analytics, recommendations
- [~] Razorpay one-time orders per plan; payment signature checked server-side and payment re-read from Razorpay; HMAC-verified webhook (raw body); idempotent settle (row lock on status); amount/currency checks
- [~] Subscriptions: buying extends the period, cancel keeps access until period end, refunds end access, status/history/invoice numbers, admin plan price/active API (`PUT /api/admin/plans/:id`); off unless PAYMENTS_ENABLED=true
- [~] Analytics: consent banner, events only after consent, no IP/cookie id stored, admin charts (page/comic/chapter views, reading sessions, active readers), top comics/genres/searches
- [~] Recommendations: separate service; genre affinity from bookmarks, ratings >= 7 and history, plus popularity and recency; popular fallback
- [ ] Not built: automatic recurring renewals (needs Razorpay Subscriptions + plan ids), partial-refund handling (any refund ends access), premium-gated content (no perks are live), PDF invoices, retention reports, event purge job, admin plans UI, admin payments list
- [ ] Never tested against real Razorpay: use test keys and a tunnel (e.g. ngrok) for the webhook first
## Phase 8 - Quality and deployment
- [x] Unit tests (13) for image sniffing/dimensions, slugs and crypto helpers: **run and passing** (Node test runner)
- [~] API integration tests (Jest + supertest, ~20 cases: auth, CSRF, bookmarks, progress, authorization, publishing, ratings, errors, suspension) - written, not run
- [~] Playwright browser tests for the reader journey and the admin journey - written, not run; upload journey needs S3 (`E2E_S3=1`)
- [~] Security review written up in docs/SECURITY.md; 8 issues fixed, remaining risks listed
- [~] Performance: cache (Redis or memory), gzip, trigram index SQL, health check; nothing measured
- [~] Deployment: Dockerfile, CI workflow, DEPLOYMENT.md, env templates, backup and monitoring plan
- [~] Also: Continue reading button, page counter in reader, scheduled publishing job, cleanup job, Resend email provider
- [ ] Not done: component tests, load tests, accessibility audit, banners, comments, email/push notifications, payments verification

## Phase 9 - Completion pass
- [~] Reader: paged mode, right-to-left mode, zoom (100-200%), arrow keys, tap zones, swipe, preloading the next two pages, preferences remembered, position kept when switching modes
- [~] Pages: About, Contact, Privacy, Terms, Copyright policy (drafts that match what the app does; **need legal review**; fill NEXT_PUBLIC_OPERATOR_NAME / CONTACT_EMAIL / JURISDICTION)
- [~] Profile: settings (username, bio, password, notifications, account deletion), my reviews, profile navigation; `/profile` redirects
- [~] Report button on comics (feeds the admin reports page)
- [~] Tests added: reader modes (Playwright), account deletion (API)
- [~] Covers: images uploaded in the admin comic form are now returned as `coverUrl` and shown on cards, the home hero and the comic page (gradient stays as the fallback)
- [ ] Still not built: homepage banners (banner images upload but are not displayed yet) (model exists, no UI), comments and review replies, email/push notifications, avatar and cover/banner image upload, `/genres/[slug]` route (genre links use `/browse?genre=`), creator analytics/revenue, component tests, load tests, accessibility audit

## External sources
- [~] WeebCentral, Asura Scans, and ComicK external-source providers: catalog search, details, paged chapter lists, chapter page lists, and admin approval
- [~] Web: `/sources`, `/sources/:source/:id`, reader integration (existing reader reused, local progress), saved titles page, `/admin/sources`
- [~] Database: `SourceSetting`, `ExternalLibraryEntry` (run `npx prisma migrate dev --name external_sources`)
- [x] Run here: Prisma schema validation, type-checks, 39 API unit tests and 5 web unit tests (mocked responses)
- [ ] Not run: API integration tests, browser tests, `next build`, lint, or live provider requests
