# ComicK chapter catalogue pagination fix

The prior Node route probe provided by the user succeeded on `/comic/{hid}/chapters?page=1&limit=20&lang=en`. The admin review screen was sending `limit=500`. This patch changes ComicK to 20-item pages, matching the known-good request shape. Other source providers keep their existing UI page size and first-import batch size.

It also fixes a second pagination bug: the ComicK endpoint already receives `page` and `limit`, so the normalizer must not slice the returned page again. Previously that could discard the rows returned for page 2 and later.

Files:
- `apps/web/src/components/admin/SourceTitleReview.tsx`: ComicK review page uses 20 chapters per page; other sources remain at 500.
- `apps/api/src/sources/comick.provider.ts`: ComicK provider caps requests to 20 even if a caller submits a larger limit.
- `apps/api/src/sources/sources.service.ts`: ComicK approval imports the first 20 chapters; later pages remain importable.
- `apps/api/src/sources/comick.normalize.ts`: preserves the already-paginated rows from ComicK.
- Provider/normalizer tests: verify the 20-item cap and page-2 row retention.

This is based on the successful `limit=20` route diagnostic supplied by the user. It does not bypass Cloudflare. If ComicK returns 403 even for the exact 20-item request, the remaining issue is an upstream Cloudflare challenge rather than pagination.
