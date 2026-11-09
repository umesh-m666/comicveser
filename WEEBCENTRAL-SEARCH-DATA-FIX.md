# ComicVerse — WeebCentral catalogue fix

This update is based on the uploaded `comicverse-catalog-updated-full (1).zip` and keeps the existing admin catalogue and delete/republish fixes.

## Root cause

The admin UI was requesting WeebCentral's advanced search page (`/search`). That URL serves the search interface; the result cards are returned separately by WeebCentral's HTML fragment endpoint (`/search/data`). Parsing the page shell therefore produced a successful response with zero titles.

The WeebCentral result fragment uses `<article>` cards. A card's series link contains the series ULID, the cover image alt text ends in `cover`, and the Manga/Manhwa/Manhua type is exposed in a `data-tip` attribute. The adapter now requests `/search/data` (not the search-page shell) and parses fragment responses as well as full HTML.

## Updated files

Source TypeScript:

- `apps/api/src/sources/weebcentral.provider.ts`
- `apps/api/src/sources/weebcentral.normalize.ts`
- `apps/api/src/sources/weebcentral.provider.test.ts`
- `apps/api/src/sources/weebcentral.normalize.test.ts`
- `apps/api/src/sources/sources.dto.ts` — accepts `q=""` for Show All
- `apps/api/src/sources/sources.service.ts` — preserves the delete/republish repair
- `apps/api/src/comics/comics.service.ts` — detaches stale source mapping on Comic Management delete
- `apps/web/src/components/admin/SourceCatalog.tsx` — keeps the Show All Titles UI

The matching compiled API files under `apps/api/dist/` are also updated, so `start:prod` does not keep executing the old adapter.

## Installation

1. Back up your existing project.
2. Extract this ZIP over the project folder, keeping your local `.env` / `.env.local` files.
3. Stop the API process that is currently listening on port 4000 (`Ctrl+C` in its terminal).
4. In a terminal opened at the project root, run:

   ```powershell
   cd apps/api
   npm ci
   npm run build
   npm run start:dev
   ```

   If dependencies are already installed, `npm ci` can be omitted. Use `npm run start:prod` instead of `start:dev` only when intentionally running the compiled `dist` build.

## Verify that the updated API is running

Open Admin → Comics → WeebCentral. The provider badge should say **3 supported types**, not **1 supported type**. This badge is returned by `WeebCentralProvider.info()` and is a quick indicator that the new API implementation is running. If it still says 1, an old API process or a different project directory is still serving port 4000.

Click **Show All Titles**. The API request should use `/api/admin/sources/catalog/search?source=weebcentral&q=&page=1&limit=20`; the provider adapter translates this into a request to WeebCentral's `/search/data` endpoint with `text`, `limit`, `offset`, and `display_mode` parameters.

## Verification and limitations

The WeebCentral provider/normalizer tests include the current article-fragment structure, tooltip content types, empty-query Show All, pagination, and anti-bot challenge detection. A direct live request to WeebCentral was not possible in the build environment. If the upstream site blocks the API server, the adapter now reports an upstream-blocked error instead of silently displaying an empty catalogue. This update does not bypass upstream access controls.

## ComicK API host refresh

The ComicK adapter now targets `https://api.comick.dev` (the current API host used by the Comick deployment) and sends browser-origin headers for `https://comick.dev`. The normalizer accepts both legacy `md_*` catalog fields and the newer `titles`, `cover_url`, and `description` fields, including plain-array chapter and image responses. Numeric publication status mapping was corrected to the current ordering. This does not bypass upstream rate limits or access restrictions.
