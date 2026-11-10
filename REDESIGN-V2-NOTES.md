# ComicVerse redesign v2 — navigation, reader, bookmarks, account

Builds on `REDESIGN-NOTES.md` (which it supersedes where they differ, e.g. the navigation). Stack unchanged: Next.js 14 + Tailwind, NestJS + Prisma/PostgreSQL. **No new npm dependencies** (animations are CSS-only; Framer Motion is not installed in this project).

## Run
```bash
cd apps/api && npm install && npx prisma migrate deploy && npm run db:seed && npm run start:dev
cd apps/web && npm install && npm run typecheck && npm run build && npm run dev
```
The one database migration is `apps/api/prisma/migrations/20261110120000_reading_state` — additive and idempotent, existing rows are kept. No new environment variables.

## What changed

### Design system (`app/globals.css`)
Palette moved to the requested tokens (`--bg #100E16`, `--surface #191522`, `--card #211B2D`, `--primary #9333EA`, `--secondary #A855F7`, `--accent #C084FC`, `--muted #A8A1B5`, `--read #A855F7`). New reusable classes: `cv-iconbtn`, `cv-menu`/`cv-menu-item`, `cv-tabbar`, `cv-page`, `cv-ch` (read/unread/current colours), `cv-progress`, `cv-bm-card`. `prefers-reduced-motion` disables all of the new animation.

### Navigation
- **Desktop (≥1024px):** Home · Novels · Manga · Browse · Resources ▾ · Bookmarks, then Search, Upgrade (≥1280px, hidden for admins and premium members), notification bell with unread badge, avatar. Removed from the nav: Genres ("Gender"), Latest Updates, Admin Panel, Log out. Genres remain available as Browse filters.
- **Account popup** (avatar click): avatar + name + email + role, then **Admin Panel (administrators only)**, Profile, Messages, Alerts, Settings, Log out. Animated open/close, closes on outside click / Escape / route change, `role="menu"`, full-width-safe on phones.
- **Mobile/tablet (<1024px):** compact header (logo, search icon that drops a search bar, bell, avatar) and a fixed, blurred, safe-area-aware bottom bar: Home · Novels · Manga · Browse · Bookmarks. A single purple pill slides between tabs, the active icon scales, and page content fades/slides in (direction follows the tab you move to). Content is padded so nothing hides behind the bar.
- Files: `components/Nav.tsx`, `NavClient.tsx`, `AccountLink.tsx`, `ProfileMenu.tsx`, `NotificationBell.tsx`, `BottomNav.tsx`, `PageTransition.tsx`, `ChromeGate.tsx`, `lib/nav.ts`, `lib/useDismiss.ts`.

### Reader (`Reader.tsx`, `ReaderControls.tsx`)
- Header: comic title always white; chapter label + page/percent. Chapter label turns **purple with a check** once the chapter is finished.
- Controls: back, bookmark toggle, settings, previous / chapter list / next, scroll-to-top, progress bar with percentage. Tap-to-toggle, auto-hide, swipe paging and "artwork is never a link" behaviour are unchanged.
- **Completion rule (new):** a chapter is marked read only when its last page has been reached (scrolled to the end in vertical mode, final page in paged mode) *and* it has been open for ≥5 s. Opening a chapter never marks it read. External-source chapters (no ComicVerse chapter row) are not tracked.
- Chapter list colours (reader sheet, comic page, account page): unread = white, current = purple highlight, read = purple text. Read state is stored server-side per user (`ChapterRead`), so it survives refresh, logout/login and other devices; anonymous readers get the same behaviour from `localStorage`.

### Bookmarks (`BookmarksView.tsx`)
Header with total count and search; tabs All / Reading / Completed / Plan to Read / On Hold / Dropped (with counts); sort by Recently Updated / Recently Added / Title; cards with cover, title, type, status (changeable), current chapter, total chapters, "x / y read", percentage + purple progress bar, last-updated, Continue Reading and Remove. Loading skeletons, error state with retry, empty states (none vs. no match), pagination (24/page).
- Statuses are **automatic by default** (untouched → Plan to Read, started → Reading, every chapter of a finished comic read → Completed) and can be overridden per bookmark ("auto" is selectable again). Starting to read a Plan to Read bookmark moves it to Reading.

### Account page (`AccountDashboard.tsx`)
Profile header, reading statistics, reading history, bookmarked comics, completed chapters (purple), account settings links, notification preference toggle, Creator portal / Premium links. The Admin Panel and Log out are **not** on this page — they live only in the account popup. There was no Gender field anywhere in this project (UI, API or database), so nothing needed removing there.

### Messages & alerts (`NotificationsView.tsx`)
There is no private-messaging feature in this project, so **Messages** is the inbox of notes from ComicVerse, creators and review replies (notification types PLATFORM / ACCOUNT / CREATOR_ANNOUNCEMENT / REVIEW_REPLY); **Alerts** is new-chapter and bookmark-update notifications. Both are tabs of `/profile/notifications` (`?tab=messages|alerts`); the bell badge counts both.

### Admin access
Unchanged and verified by reading the code: `/admin/*` pages are guarded in `app/admin/layout.tsx` (non-admins see "Admin access required"), and every `/admin/*` API route is protected by `SessionGuard` + `PermissionGuard` on the backend. The popup only decides whether to *show* the item.

## API additions (all additive; existing endpoints keep their shapes)
| Endpoint | Purpose |
|---|---|
| `GET /user/bookmarks?q&status&sort=updated\|added\|title&page&limit` | Now returns `{ total, page, pageSize, counts, items }`; items add `status`, `statusSource`, `lastUpdatedAt`, `comic.coverUrl/totalChapters`, `progress{readCount,percent,lastReadAt,current}`. `sort=recent` still works (= added). |
| `PUT /user/bookmarks/:comicId/status` | `{ status: READING\|COMPLETED\|PLAN_TO_READ\|ON_HOLD\|DROPPED\|AUTO }` |
| `POST /user/chapters/:chapterId/read` | Mark a chapter finished (validates it is a visible, published chapter) |
| `GET /user/comics/:comicId/read-chapters` | Ids of finished chapters for one comic |
| `GET /user/read-chapters` | 30 most recently finished chapters |
| `GET /user/stats` | bookmarks, chapters read, comics started, per-shelf counts |
| `GET /user/notifications?group=messages\|alerts` | Optional filter (default = all) |

Schema: `enum BookmarkStatus`, nullable `Bookmark.status` (NULL = automatic), `Bookmark.updatedAt`, new table `ChapterRead (userId, comicId, chapterId, readAt)` with cascading FKs and indexes. The migration back-fills `ChapterRead` from existing reading history using the rule the app already applied (chapters numbered below the reader's current chapter count as read), so existing readers keep their progress. Account deletion also removes `ChapterRead` rows.

## Modified files
API: `prisma/schema.prisma`, `src/auth/auth.module.ts`, `src/notifications/notifications.service.ts`, `src/user/dto/user.dto.ts`, `src/user/user.controller.ts`, `src/user/user.service.ts`
Web: `app/globals.css`, `app/layout.tsx`, `app/profile/{bookmarks,history,notifications}/page.tsx`, `components/{AccountDashboard,AccountLink,BottomNav,ChapterList,ChromeGate,Library,LibraryProvider,Nav,NavClient,ProfileNav,Reader,ReaderControls}.tsx`, `e2e/{account,reader-journey,reader-modes}.spec.ts`

## New files
API: `prisma/migrations/20261110120000_reading_state/migration.sql`, `src/user/bookmark-status.ts`, `src/user/bookmark-status.test.ts`
Web: `components/{BookmarksView,NotificationBell,NotificationsView,PageTransition,ProfileMenu}.tsx`, `lib/{media,nav,useDismiss,useReadChapters}.ts`

## Testing status — read this
This work was done in a sandbox **without network access**, so dependencies could not be installed. What was and was not verified:
- ✅ `src/user/bookmark-status.test.ts` (status derivation, percentage, sorting): 9/9 pass.
- ✅ Every changed/new `.ts`/`.tsx` file parses (TypeScript syntax check).
- ❌ **Not run:** `npm install`, `prisma generate`, `prisma migrate`, `tsc`/`npm run typecheck`, `next build`, the API e2e suite, the Playwright suite, and any browser testing at the viewport sizes you listed. Type errors (particularly against the regenerated Prisma client) are possible until you run the commands above.
- Playwright specs were updated for the new navigation (account menu instead of header buttons, `Primary` nav landmark) but have not been executed. No new Playwright spec was written for the bookmarks page or read-state colours.

Suggested first run: `prisma migrate deploy` → `npm run build` in both apps → `npm test` (api) → `npm run test:e2e` (web).

## Limitations / interpretations
- "Gender" in your brief was read as the **Genres** menu (there is no gender field anywhere).
- The AsuraScans screenshots were not in the upload (only the zip and the prompt text), so styling follows your written palette and description rather than pixel-matching the site.
- "Messages" is the platform/creator inbox described above, not user-to-user chat.
- Reading progress percentage = finished chapters ÷ published chapters. It counts chapters finished under the new completion rule (plus the history back-fill).
- Chapters from external sources (`/sources/...` reader) keep their existing local-only progress and have no read colouring or bookmark button.
- The Creator portal link moved from the header to the account page (admins don't see it).
