# ComicVerse provider catalogue update

## Files changed in this update

- `apps/web/src/components/admin/SourceCatalog.tsx`
  - Adds a **Show All** action which calls the existing provider search endpoint with an empty `q` so providers can return their default/unfiltered listing.
  - Keeps the title search, content-type filter, and review-status filter.
  - Adds selectable result cards, a select-visible control, and bulk approve/publish/republish for up to 10 selected titles.
  - Adds per-title quick Approve & Publish / Republish actions.
  - Uses each title's available languages when approving and updates the UI after successful actions.
- `apps/api/src/sources/sources.dto.ts`
  - Allows `q` to be an empty string (default `""`) so the admin catalogue can request a provider's default listing.

## API behavior and limits

The update reuses the existing admin API routes for searching, title details, approval, and republishing. No new database schema or bulk backend endpoint is introduced. Bulk publish calls the existing per-title endpoint sequentially and is capped at 10 selections to match the endpoint's configured 10-requests-per-minute throttle.

**Provider limitation:** an empty search asks each provider adapter for its default/unfiltered search response. Providers differ in whether they support this and how much they return. WeebCentral's current adapter only reports its first search-result page; the UI cannot manufacture titles or pages that the provider API does not return. A true exhaustive catalogue requires a provider-specific browse/list endpoint where one is available.

## Validation

The changed TSX and DTO files passed a TypeScript transpile/syntax check. A complete application typecheck/build was not run because dependencies are not installed in this environment.
