# ComicVerse UI/UX redesign — notes

## Run
```bash
cd apps/api && npm install && npx prisma generate && npm run start:dev   # API  http://localhost:4000/api
cd apps/web && npm install && npm run typecheck && npm run build && npm run dev   # Web http://localhost:3000
```
No new dependencies and no database migration were added.

## Web (apps/web/src)
- `app/globals.css` – new design system (#0B0910 / #17121F / #21192D, purple #9333EA / #A855F7), reusable `cv-chip`, `cv-btn`, `cv-tab`, reader (`rd-*`) classes. Old class names are kept so other pages still render.
- `app/layout.tsx` + `components/ChromeGate.tsx` – header, footer, bottom nav and page padding are NOT rendered on chapter routes (`/comics/*/chapter/*`, `/sources/*/*/read/*`).
- `components/Nav.tsx`, `NavClient.tsx` – Home, Browse, Genres dropdown, Latest Updates, Bookmarks, search, profile; hamburger menu below `lg`.
- `components/LibraryProvider.tsx` – one shared fetch of bookmarks + reading history (2 requests, none when signed out) used by every card, button and chapter row.
- `components/ComicCard.tsx` – cover, rating, status, type, genres, latest chapter, chapter count, reading status, bookmark toggle.
- Home: `FeaturedCarousel`, `PopularTabs` (weekly / monthly / all time), `LatestUpdates`, trending row, recently added, announcements, skeletons (`LoadingSkeleton`) and `EmptyState`.
- Browse (`app/browse/page.tsx`): debounced title/alt-title search with clear + spinner, 6 sorts, multi-select genres, status, type, creator, minimum chapters, active-filter chips, reset, inline mobile filter panel, skeletons, empty/error states. State lives in the URL.
- Details (`app/comics/[slug]/page.tsx`, `ChapterList`): cover, alt title, rating, creators, status, Start / Continue / Latest buttons, bookmark, chapter list with working newest/oldest sort, read progress and Latest badge.
- Reader (`Reader.tsx`, `ReaderControls.tsx`): see below.

## Reader behaviour
- Default view = chapter images only (black background, no header/footer/bars/buttons).
- Tap the artwork to show/hide the translucent controls (title, chapter, page, previous/next chapter, chapter list, settings, back to comic). Controls auto-hide after 4 s, hide when you scroll, and appear when you reach the end of a chapter.
- Artwork is never a link, so tapping can't navigate. In paged mode the left/right 30% of the screen turn pages and the middle toggles controls.
- Keys: ← / → previous / next chapter (pages in paged mode), F full screen, Esc closes a panel or returns to the comic (ignored while typing in a field).
- Images keep their aspect ratio (reserved via width/height, no cropping, no gaps), lazy-load after the first two, retry on failure. Progress (chapter + image index) is saved with the existing endpoints / localStorage.

## API (apps/api/src/comics) – additive, backward compatible
- `GET /comics`: `genre` accepts comma-separated slugs (must match all), new `creator`, `minChapters`, and `sort=rating|chapters`. Items now include `chapterCount`.
- `GET /comics/popular?period=weekly|monthly|all` – weekly/monthly rank by recorded COMIC_VIEW events (padded with all-time leaders).

## Known limitations
- "Cancelled" status is not offered: the database enum only has Ongoing / Completed / Hiatus and adding it needs a migration.
- Previous chapter in Latest Updates is not shown (the list API only returns the latest chapter).
- Weekly/monthly popularity rankings depend on visitors having accepted analytics.
- Single-page ("paged") mode keeps ←/→ as page turns rather than chapter jumps.
