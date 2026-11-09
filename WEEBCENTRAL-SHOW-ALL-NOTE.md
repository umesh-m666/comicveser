# WeebCentral browse behavior

This update deliberately preserves the uploaded project's existing WeebCentral provider and normalizer unchanged. Its current integration uses the public `POST /search/simple?location=main` quick-search route, which requires a non-empty search term and is not an unfiltered catalogue endpoint.

To avoid changing that working provider request, the admin **Show All** action for WeebCentral sends the broad one-character query `a` through the same existing quick-search route. The UI labels these as quick-search suggestions, not a complete provider catalogue. Other providers continue to receive an empty query for their real default catalogue route.

The compiled API DTO is synchronized with `apps/api/src/sources/sources.dto.ts` so production-mode runs also accept empty `q` for providers that support true unfiltered catalogue browsing (such as Asura Scans).
