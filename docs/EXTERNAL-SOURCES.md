# External sources (WeebCentral, Asura Scans, and ComicK)

ComicVerse administrators can search external catalogs, inspect title details and chapters, and explicitly approve titles for publication. Approved chapters use ComicVerse's reader. Source retrieval runs through the API; chapter images are loaded directly from the providers and are never downloaded or stored by ComicVerse.

```
Admin -> ComicVerse web -> ComicVerse API -> WeebCentral / Asura Scans / ComicK
Reader -> ComicVerse API (chapter page list) -> provider image URLs in the browser
```

## Providers

| Provider | Catalog and chapter flow | Limits |
|---|---|---|
| WeebCentral | Public quick-search form, series details, full chapter-list fragment, and chapter image fragment. | Search is limited to the results returned by quick search; the site does not expose pagination for that result. Chapters are sorted/paginated locally from its full list. Its published `robots.txt` crawl delay is 10 seconds; requests are serialized per API process to honor it. English only. |
| Asura Scans | Publicly linked series-search API with `offset` pagination; title details use that same search API; chapter links are read from the public series page and page URLs from the public chapter page. | Chapter lists are parsed in full and then paginated by ComicVerse. English only. Search/chapter offsets are bounded to 10,000 results. |
| ComicK | JSON search, title details, language-filtered chapter listings, and chapter image-list routes referenced by [`Raby012/-manga-novel-api`](https://github.com/Raby012/-manga-novel-api). | ComicK's API response does not provide an exact search result total in the referenced contract, so search shows a lower-bound count. Chapter pagination is capped at 10,000 results. Image URLs are returned directly; ComicVerse does not proxy or store them. |

These integrations can depend on provider-controlled APIs or page markup that may change. ComicVerse uses ordinary requests with the configured application User-Agent. It does not spoof browser fingerprints, evade challenges, rotate proxies, or retry a refusal through another route. A 401/403 is reported as unavailable. WeebCentral's delay can make its catalog operations noticeably slower. The referenced ComicK API repository describes its upstream service as Cloudflare-protected and uses challenge-evasion; ComicVerse does not include that mechanism. The normal ComicK search request returned HTTP 522 during this integration, so successful live availability has not been verified.

## Enable

Set these variables in `apps/api/.env`:

```env
SOURCES_ENABLED=true
SOURCES_USER_AGENT=ComicVerse/1.0 (+https://your-site.example)
SOURCES_TIMEOUT_MS=10000
```

`SOURCES_ENABLED` defaults to `false`; timeout must be a whole number from 1,000 to 60,000 ms. The User-Agent must identify your app and must not imitate a browser. No provider-specific host configuration or secret is required.

Start the API and web app as usual. On `/admin/comics/new`, search the enabled source catalog, inspect the title and its chapter pages, then approve or reject it. Only approved titles are published in ComicVerse. `/admin/sources` lets admins enable, disable, rename, and test the providers.

## API behavior

- `GET /api/sources` lists enabled providers and capabilities. External catalog search and title approval are admin-only.
- Admin catalog routes are `/api/admin/sources/catalog/search?source=&q=&page=&limit=`, `/api/admin/sources/catalog/:sourceId/:externalId`, and `/chapters?language=&page=&limit=`.
- Approval imports up to 500 chapters. Additional chapter pages can be imported with `.../chapters/import?page=&language=&limit=`. Each provider enforces the shared 10,000-result offset cap.
- Public title details, source chapter listings, and chapter page lists are available only for approved and published titles. Chapter images remain hosted by the external provider.
- Asura Scans search requests use the provider's `limit`/`offset` values. WeebCentral chapter lists and Asura Scans series chapter lists are both paginated in ComicVerse, even when the source provides one complete list.
- ComicK uses the referenced `api.comick.io` routes for search, details, chapters, and pages. Details/chapter/page requests preserve ComicK HIDs as source-specific IDs. ComicK page image lists are read completely from one response, deduplicated without changing order, and image URLs are validated against ComicK's documented image hosts. The ComicK API does not expose an exact search total in the referenced implementation; the catalog displays the observed lower bound with `+`.
- The reader receives the complete page list for the selected chapter before rendering. It does not expose a manual “load more pages” action. Each image keeps the reader's existing retry/error UI; previous/next navigation is separate and may be unavailable if chapter metadata fails.
- Covers and page images are direct HTTPS URLs from the providers. They are not proxied or saved in ComicVerse storage.
- Chapter page results are not cached. Search, title details, and chapter metadata use the existing server cache.

## Content rights and legacy data

External source approval is a publication workflow, not a license. Before enabling the feature in a deployment, confirm that your organization is authorized to retrieve and display content from each provider and comply with the providers' current terms and robots policies. Do not use ComicVerse to redistribute material without permission.

MangaDex is no longer registered as an active provider. Existing MangaDex-linked database rows are preserved and are not migrated or deleted, but this release cannot fetch their source chapters. Review any previously published MangaDex-linked comics before upgrading; they may need to be unpublished or migrated separately.

## Troubleshooting

| Result | Meaning |
|---|---|
| 503 "External sources are turned off" | Set `SOURCES_ENABLED=true` and restart the API. |
| 503 "disabled by an administrator" | Re-enable the provider on `/admin/sources`. |
| 504 / 503 | The source timed out or could not be reached. Use **Test connectivity**; a refusal is not retried. |
| 429 | The provider or ComicVerse rate limit was reached. Wait before retrying. |
| Empty WeebCentral search | Quick search may return no matching result; its public quick-search response has no page control. |
| No chapter pages | The provider did not return page image URLs for that chapter, or its public page format changed. |
| Prisma error mentioning `SourceSetting`, `ExternalLibraryEntry`, `SourceTitle`, or `SourceChapter` | Apply the external-source and publication-workflow migrations. |

## Tests

- `cd apps/api && npm test` runs provider, normalization, configuration, and existing API unit tests with mocked provider responses.
- `cd apps/api && npm run test:e2e` runs the external-source API tests against a throwaway test database and a fake provider. It refuses to run unless the configured database name contains `test`.
- `cd apps/web && npm test` runs the reader chapter-navigation tests.
- `cd apps/web && npm run test:e2e` runs browser tests with mocked API responses.

The test suites do not contact WeebCentral, Asura Scans, or ComicK.
