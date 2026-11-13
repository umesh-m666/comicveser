# Authentication, Account page and Admin Panel fix

## What was wrong (root cause)

1. **`components/Nav.tsx` → `BottomNav` hardcoded the Account tab to `/login`.** The mobile Account button never looked at
   the session; it always opened the login form, even for a signed-in user. (The login form itself also never checked
   whether you were already signed in.)
2. **The header account menu (`AccountLink`) is `hidden md:flex`**, so on mobile there was no account/admin UI at all.
3. There was **no `/account` page**; "Account" had nowhere to go. Every component also did its own `GET /auth/me`
   (header on each route change, admin layout, etc.), so there was no single source of truth and pages could briefly
   render the wrong state while a check was in flight.

The backend session mechanism was correct and was not changed: login sets an httpOnly `cv_session` cookie
(30 days, hashed in the `Session` table), `GET /auth/me` returns the user, and the admin API is protected by
`SessionGuard` + `PermissionGuard` / `AdminRoleGuard` on the server.

## What changed (frontend only; no DB or backend changes)

- `components/AuthProvider.tsx` (new): one app-wide auth state read from `GET /auth/me`, with states
  `loading | authenticated | anonymous | error`. It re-verifies on tab focus, after any API call returns 401 (it
  confirms with `/auth/me` first, since a wrong password also returns 401), and after profile changes. A network error
  never logs a valid user out. If an authenticated session turns out invalid, the user is sent to login with an
  "expired" notice.
- `components/BottomNav.tsx` (new): Account now links to `/account`, with active-state highlighting and safe-area padding.
- `app/account/page.tsx` + `components/AccountDashboard.tsx` (new): responsive Account page.
  Signed in: avatar (or initial), username, email, role, bio, member-since, Admin Panel (admins) or Creator portal,
  bookmarks/library, reading history, saved sources, reviews, messages & alerts (existing notifications), profile,
  settings, account management, log out. Signed out: Log in and Create account.
  Mobile: single column, 56px touch rows. Desktop (md+): sticky profile card + two-column grid.
- `components/RequireAuth.tsx` + `app/profile/layout.tsx` + `app/creator/layout.tsx` (new): protected sections wait for
  the real session check, then redirect anonymous users to `/login?next=<page>`. Redirects use `replace`, so Back doesn't loop.
- `app/admin/layout.tsx`: uses the shared state; anonymous → login, non-admin → "Admin access required" message.
  This is UI only: every `/admin/*` API endpoint is still authorised by the backend (401 anonymous, 403 non-admin;
  covered by the existing API e2e test). No roles or permissions were changed.
- `components/AuthForm.tsx`: no form flash while the session loads; a signed-in user visiting `/login` or `/register`
  is redirected; after login it returns to `next` (validated to be a same-site path) or `/`.
- `components/AccountLink.tsx`: uses the shared state (no per-navigation `/auth/me` request); username links to `/account`.
- `lib/api.ts`: emits an event on 401. `profile/settings`: deleting an account now uses the shared logout.
- `e2e/account.spec.ts` (new): Playwright scenarios for the test matrix.

Route protection is done client-side on purpose: the session cookie may belong to the API's domain (cross-origin
deployments), where Next.js middleware can't see it. The backend remains the actual authority.

## Deployment note

In production the cookie is `Secure`, `SameSite=Lax`. Keep web and API on the same site (or use the `/api` rewrite via
`API_INTERNAL_URL` + `NEXT_PUBLIC_API_URL=/api` already supported in `next.config.mjs`), set `WEB_ORIGIN` on the API to the web origin.

## Verification status (please read)

The sandbox this was prepared in had **no network access**, so dependencies could not be installed and there was **no
PostgreSQL**. Therefore:

- **Not run:** `npm run build`, `typecheck`, unit tests, API e2e, Playwright tests, and no manual browser testing.
- **Done:** a TypeScript syntax parse of every changed/new file (0 errors), and code review against the existing API
  guards and endpoints.
- Please run the commands in `README.md` before relying on this. The new Playwright spec is untested and may need small
  selector adjustments.
