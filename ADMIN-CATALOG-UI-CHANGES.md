# ComicVerse admin provider-catalog UI changes

This update reorganizes the admin external-source approval workflow into three screens. It intentionally reuses the existing admin source API routes, so the WeebCentral, Asura Scans, and ComicK provider implementations and their approval/import behavior are not rewritten.

## Updated navigation

```text
/admin/comics
  └── Add comic
      └── /admin/comics/new
          ├── Provider cards
          └── /admin/comics/new/[sourceId]
              ├── Search provider titles
              ├── Filter by provider-supported content type
              ├── Filter review status / show all statuses
              └── /admin/comics/new/[sourceId]/[externalId]
                  ├── Title metadata and source link
                  ├── Chapter catalogue and language selector
                  ├── Approve & publish
                  ├── Reject title
                  ├── Unpublish / republish
                  └── Import chapter page
```

## Changed files

- `apps/web/src/app/admin/comics/new/page.tsx` — provider-selection cards.
- `apps/web/src/app/admin/comics/new/[sourceId]/page.tsx` — dedicated provider catalogue page.
- `apps/web/src/app/admin/comics/new/[sourceId]/[externalId]/page.tsx` — dedicated title-review route.
- `apps/web/src/components/admin/SourceCatalog.tsx` — redesigned provider search and results; Inspect navigates to the review route instead of opening a modal.
- `apps/web/src/components/admin/SourceTitleReview.tsx` — new full-page title and chapter review UI, retaining the existing admin actions.

## Existing API calls retained

- `GET /admin/sources`
- `GET /admin/sources/catalog/search`
- `GET /admin/sources/catalog/:sourceId/:externalId`
- `GET /admin/sources/catalog/:sourceId/:externalId/chapters`
- `POST /admin/sources/catalog/:sourceId/:externalId/approve`
- `POST /admin/sources/catalog/:sourceId/:externalId/reject`
- `POST /admin/sources/catalog/:sourceId/:externalId/unpublish`
- `POST /admin/sources/catalog/:sourceId/:externalId/republish`
- `POST /admin/sources/catalog/:sourceId/:externalId/chapters/import`

## About “Show all”

The current backend's provider search DTO requires a non-empty `q`, and the provider interface only defines search (not a global catalogue/list-all operation). Some providers may not expose a browse-all endpoint at all. Therefore the UI's “Show all statuses” control means show all review states within the current provider search results; it does not claim to download every title in a provider's catalogue. A true catalogue-wide browse feature requires verified list/browse endpoints in each provider adapter and backend support.

## Verification

All five changed TS/TSX files passed TypeScript syntax transpilation. A full `tsc --noEmit` check was attempted but cannot be completed from this archive because dependencies are not installed (`next`, `react`, and their type packages are missing); `npm ci` did not finish in this environment. Run the install and checks locally after extracting the project:

```bash
cd apps/web
npm ci
npm run typecheck
npm run build
```

## Environment files

For safety, the updated archive excludes local secret-bearing `.env`, `.env.local`, and `.env.test` files. Keep your existing local copies; the example environment files remain in the archive.
