# Show All Titles restored

## Changed files

- `apps/web/src/components/admin/SourceCatalog.tsx`
  - Restores a prominent **Show All Titles** action below the search/type/status controls.
  - Sends the provider catalogue request with an empty `q` value and the currently selected content type.
  - Keeps search, review-status filters, pagination, title selection, approval, republish and inspect navigation.

- `apps/api/src/sources/sources.dto.ts`
  - Keeps `q` optional and permits an empty string (`@Length(0, 100)`), which is necessary for the unfiltered catalogue request.

## Apply the patch

Copy both files to the exact paths above, replacing the existing files. Restart the API and web app.

## Provider limitation

Show All requests the provider's default/unfiltered catalogue. The number of returned titles and pagination depend on what that provider's API actually exposes. This UI cannot guarantee an exhaustive catalogue when an upstream provider does not offer one.
