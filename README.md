# ComicVerse — Full-Stack Manga, Manhwa, Manhua & Novel Platform

ComicVerse is a production-ready reading and catalogue platform built with **NestJS 10 + Prisma + PostgreSQL** (`apps/api`) and **Next.js 14 App Router + Tailwind CSS** (`apps/web`).

---

## Key Features & Production Architecture

1. **Cross-Origin Production Authentication & Session Persistence**:
   - Supports both **HTTP-only cookies** (`cv_session`, automatically configured with `SameSite=None; Secure` on cross-site HTTPS deployments such as Render or Vercel) and **`Authorization: Bearer <token>`** fallback headers so sessions remain persistent across page reloads even under strict third-party cookie blocking.
   - Multi-origin CORS and CSRF `OriginGuard` via comma-separated `WEB_ORIGIN`.
2. **Google OAuth 2.0 Sign-In & Account Linking**:
   - "Continue with Google" on `/login` and `/register` powered by Google Identity Services (`GET /api/auth/config`, `POST /api/auth/google`).
   - Cryptographic RS256 ID token verification against Google's JWKS (`GOOGLE_CLIENT_ID`).
   - Automatically links existing accounts by verified email while strictly preserving `ADMIN`, `CREATOR`, and `USER` roles and permissions (and registers new Google accounts with the `USER` role).
3. **Resend Transactional Email Integration**:
   - Full HTML + plain-text email templates for Email Verification, Forgot Password, Password Changed Confirmation, Sign-In Alerts, Account Notices, and Admin Issue Report Alerts (`MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM`).
   - Validates Resend `{ data, error }` responses and records delivery diagnostics for the Admin Dashboard without exposing secrets.
4. **External Source Providers (ComicK, WeebCentral & Asura Scans)**:
   - Supports `PRIMARY` and `CHAPTER_FALLBACK` (`SourceTitleRole`) relationships per comic.
   - Normalizes all WeebCentral chapter and episode naming formats (`Chapter 1`, `Chapter 12`, `Chapter 12.5`, `Chapter 001`, `Episode 1`, `Episode 12`, `Episode 12.5`, `Episode 001`, `Ep. 12`, `Ch. 12`, `12`, `12.5`, and `Special Extra`) without misclassifying special chapters or `<time>` dates.
   - Collision-safe chapter numbering (`allocateUniqueChapterNumber`) and automatic stale fallback cleanup so publishing/importing series with duplicate chapter releases or re-imported comics never fails with `P2002`.
5. **User Issue Reporting → Admin Messages & Alerts**:
   - Readers can submit categorized issue reports (`BROKEN_CHAPTER`, `CONTENT_ISSUE`, `BUG`, `LOGIN_ISSUE`, `ABUSE`, `FEATURE_REQUEST`, `GENERAL`) from any comic/chapter or from **Profile → Messages (`/profile/notifications`)**.
   - Admins receive immediate unread alerts on the **Admin Dashboard (`/admin`)** and can filter, search, respond to, resolve, or dismiss reports in **Admin → Issue Reports & Reviews (`/admin/reviews`)**.
   - Readers receive an in-app notification (and email when configured) when an admin responds to or resolves their report.

---

## Local Development Setup

### 1. Start PostgreSQL (and optional Redis / MinIO)
```bash
docker compose up -d
```

### 2. Configure Environment Variables
Copy the example environment files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 3. Install Dependencies, Run Migrations & Seed
```bash
cd apps/api
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```
In a second terminal, start the Next.js frontend:
```bash
cd apps/web
npm install
npm run dev
```

Default seeded accounts (from `apps/api/prisma/seed.ts`):
- **Admin**: `admin@comicverse.local` / `AdminPass123!`
- **Creator**: `creator@comicverse.local` / `CreatorPass123!`
- **Reader**: `reader@comicverse.local` / `ReaderPass123!`

---

## Production Deployment (Render / Vercel / Railway)

### Backend (`apps/api`)
- **Root Directory**: `apps/api`
- **Build Command**:
  ```bash
  npm install --include=dev && npx prisma generate && npm run build && node scripts/resolve-migrations.js
  ```
- **Start Command**:
  ```bash
  npm run start:prod
  ```
- **Required Environment Variables (`apps/api`)**:
  | Variable | Example / Value | Description |
  | --- | --- | --- |
  | `NODE_ENV` | `production` | Enables production security & HTTPS cookies |
  | `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
  | `WEB_ORIGIN` | `https://your-frontend.onrender.com` | Comma-separated allowed frontend origin(s) |
  | `TRUST_PROXY` | `1` | Trusts Render/Cloudflare reverse proxy headers |
  | `COOKIE_SAMESITE` | `none` | Required when frontend & API are on separate domains |
  | `COOKIE_DOMAIN` | *(leave empty unless sharing custom parent domain)* | Optional cookie domain |
  | `GOOGLE_CLIENT_ID` | `123456-abc.apps.googleusercontent.com` | Google OAuth 2.0 Web Client ID |
  | `MAIL_PROVIDER` | `resend` | Enables Resend email delivery |
  | `RESEND_API_KEY` | `re_xxxxxxxxx` | Resend API key |
  | `MAIL_FROM` | `ComicVerse <noreply@yourdomain.com>` | Verified Resend sender address |
  | `SOURCES_ENABLED` | `true` | Enables WeebCentral, Asura Scans & ComicK |
  | `SOURCES_TIMEOUT_MS` | `10000` | Upstream provider request timeout in ms |

### Frontend (`apps/web`)
- **Root Directory**: `apps/web`
- **Build Command**:
  ```bash
  npm install --include=dev && npm run build
  ```
- **Start Command**:
  ```bash
  npm run start
  ```
- **Required Environment Variables (`apps/web`)**:
  | Variable | Example / Value | Description |
  | --- | --- | --- |
  | `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com/api` | Public URL of the ComicVerse API (`/api` suffix) |
  | `NEXT_PUBLIC_SITE_URL` | `https://your-frontend.onrender.com` | Public URL of the frontend |
  | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `123456-abc.apps.googleusercontent.com` | Google OAuth 2.0 Web Client ID |

---

## Running Automated Tests

```bash
cd apps/api
npm run build
npm test
```


## Automatic Chapter Synchronization & Render Deployment

ComicVerse automatically detects and publishes new chapters released on **WeebCentral** and **AsuraScans** for approved, published comics, repairs existing chapter numbers and release dates, sends admin-only operational alerts, and notifies readers who bookmarked the series.

### Synchronization Environment Variables (`apps/api`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SOURCES_ENABLED` | `true` | Enables external comic providers (WeebCentral & AsuraScans). |
| `SOURCE_SYNC_ENABLED` | `true` | Enables background automatic chapter detection & publishing. |
| `SOURCE_SYNC_INTERVAL_MINUTES` | `30` | Polling frequency in minutes for background synchronization. |
| `SOURCE_SYNC_BATCH_SIZE` | `20` | Maximum number of approved source titles checked per sync cycle. |

### Deploying to Render

1. Push the updated repository to your connected GitHub branch (`main`).
2. In your **Render Dashboard → `comicverse-api` → Environment**, ensure the following variables are set:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `WEB_ORIGIN` (Your frontend URL, e.g. `https://comicverse-web.onrender.com`)
   - `SOURCES_ENABLED=true`
   - `SOURCE_SYNC_ENABLED=true`
   - `SOURCE_SYNC_INTERVAL_MINUTES=30`
   - `SOURCE_SYNC_BATCH_SIZE=20`
3. Render automatically runs `npx prisma migrate deploy` (via `prestart:prod` / `render:build`) to apply the additive migration `20261112000000_auto_chapter_sync_and_admin_alerts` without resetting or deleting any existing data.
4. Multiple Render API instances coordinate safely using PostgreSQL advisory locks (`pg_try_advisory_lock`) and transactional idempotency so chapters and notifications are never duplicated.
