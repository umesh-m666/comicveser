# ComicVerse UI redesign — replacement guide

This ZIP contains the redesigned source files already placed in their correct locations.
The API, routes, API calls, authentication, billing and reader behavior have not intentionally been changed.

## Replace these files in your existing project

Copy the following files from this ZIP into the same paths in your project (overwrite the old files):

1. `apps/web/src/app/globals.css`
   - Replaces the global visual theme: dark ink background, violet/blue accent palette, form controls, cards, responsive behavior and shared UI styling.
   - This is the main file that applies the refreshed theme across all existing pages.

2. `apps/web/src/app/layout.tsx`
   - Updates the shared page container spacing. Header, footer, mobile navigation and analytics remain mounted here.

3. `apps/web/src/components/Nav.tsx`
   - Replaces the top navigation, mobile bottom navigation and footer with the refreshed ComicVerse branding.

4. `apps/web/src/components/ComicCard.tsx`
   - Replaces reusable comic cover cards used across home, browse and other listing pages.

5. `apps/web/src/app/page.tsx`
   - Replaces the homepage layout: spotlight hero, trending carousel, fresh chapter updates, reader rankings, new additions, novels and announcements.

6. `apps/web/src/app/admin/layout.tsx`
   - Restyles the admin navigation shell. Admin routes and access checks are unchanged.

## How to apply

- Extract the ZIP.
- Open your existing repository's `apps/web` folder.
- Copy the six files above into the matching paths.
- Do not replace your API folder or `.env` files.
- From `apps/web`, run `npm run typecheck`, then `npm run build`, then `npm run dev`.

## Pages covered by the shared theme

The global stylesheet and navigation are shared by:
- Home `/`
- Browse `/browse`
- Comics `/comics/[slug]` and chapter reader routes
- Novels `/novels` and novel reader routes
- Login, register, password reset and email verification
- Premium and profile pages
- Creator dashboard and creator pages
- All admin pages under `/admin`

The home page and reusable comic cards receive the more substantial layout redesign. Other routes keep their existing page-specific structure and functionality but inherit the new shared visual system. Review those pages in the browser after copying; any page-specific layout can be refined next without changing the API.
