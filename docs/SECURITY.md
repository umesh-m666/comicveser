# Security review (Phase 8)

Method: a manual read of the whole codebase against the requirements list, plus automated tests for the controls below.
**Not done:** no penetration test, no dependency audit run (no network where this was written; CI runs `npm audit`), no review of your hosting configuration.

## Controls in place
| Area | What exists | Checked by |
|---|---|---|
| Passwords | Argon2id, 10-128 chars, never returned by any endpoint | API e2e: no `passwordHash` in responses |
| Sessions | Random 256-bit token, only its SHA-256 stored, HTTP-only, SameSite=Lax, Secure in production, 30 days, deleted on logout/password change/suspension | API e2e: cookie flags, suspended user signed out |
| Login | One generic error, equal work for unknown email, 5 attempts/min/IP | API e2e: generic message |
| CSRF | SameSite=Lax plus an Origin check on every state-changing request | API e2e: 403 without Origin |
| Authorization | Server-side permission guard on every admin route; ownership checks for creators; user data always scoped to the session user | API e2e: 401/403 cases |
| Input | Whitelist validation, unknown fields rejected (blocks mass assignment such as `role`), Prisma parameterised queries, raw SQL only via tagged templates | API e2e: extra field rejected |
| Uploads | Server-chosen keys, key-prefix check, 10 MB cap, real type from file bytes (SVG/HTML/ZIP/EXE rejected), size sanity limits, SHA-256 duplicate rejection, ZIP: path traversal, size, count and in-memory extraction | Unit tests for sniffing and size parsing |
| Errors | One error shape, no stack traces or internals in responses | API e2e |
| Headers | Helmet on the API; nosniff, frame deny, referrer, permissions and (production) CSP + HSTS on the web app | Manual |
| Audit | Admin and creator actions logged with actor | API e2e |
| Privacy | Analytics only after consent, no IP stored, 400-day retention purge | Manual |
| Payments | Off by default; webhook HMAC over the raw body; browser result re-verified with the provider; idempotent | **Never run against Razorpay** |

## Issues found and fixed in this phase
1. Cookie `Secure` flag was computed when the file loaded, which could happen before environment variables were read. Now computed per request. Added `COOKIE_DOMAIN` for app/api subdomains.
2. `.env` was only loaded as a side effect of Prisma. Now loaded explicitly at startup.
3. No production configuration check. The API now refuses to start in production without database, HTTPS web origin, storage and mail settings.
4. A failed email send after registration returned a 500 and left a half-finished signup. Sends are now logged, not thrown, and a real provider (Resend) was added.
5. Behind a proxy every visitor looked like one IP for rate limiting. Added `TRUST_PROXY`.
6. The 100 KB JSON limit rejected long novel chapters. Raised to 1 MB.
7. Expired sessions, reset tokens and old analytics were never deleted. Added a cleanup job.
8. The web app sent no security headers. Added them, with a Content-Security-Policy in production.

## Known risks that remain (decide before launch)
- **No per-account lockout.** Login is limited per IP only. Add Cloudflare rate-limiting rules in front of `/api/auth/*`.
- **Upload size cannot be capped before upload.** A presigned PUT cannot limit size; an oversized object is deleted when registered, but an approved creator could still store junk first. Use a bucket lifecycle rule for unregistered objects and storage quotas. (R2 does not support size-limited presigned POSTs.)
- **No malware scan.** Files are validated as images by their bytes only. Add a scanner service if you accept uploads from untrusted creators.
- **Public image URLs.** With `CDN_BASE_URL` set, anyone with a link can fetch page images. Hotlinking protection is a CDN setting, not code.
- **Sign-up reveals taken emails/usernames** (409). Accepted for usability.
- **No two-factor authentication**, including for admins.
- **CSP allows `unsafe-inline` scripts** because Next.js injects inline scripts; moving to nonces is a later hardening step.
- **Scheduled jobs and notifications run inside the API process.** Fine for one or two instances; use a real queue for scale.
- **Payments have never run against the real provider.**
