# ComicK details fallback

The Nov 8 2026 local diagnostics showed that ComicK search, chapter-list, and chapter-page metadata endpoints returned HTTP 200, while every tested `/comic/{slug-or-hid}` detail path returned a Cloudflare challenge (HTTP 403).

ComicVerse does not attempt to evade Cloudflare or impersonate a browser. The API now keeps recent ComicK search summaries (30-minute TTL, maximum 1,000 entries). If the detail endpoint returns a confirmed Cloudflare 403, the admin title-review screen uses the cached search summary so title review and chapter loading can continue. The page displays a notice that authors, artists, year, and available languages may be incomplete.

`SourcesService.search()` rehydrates this provider cache even when the application's Redis/in-memory search cache returns a previously cached page. If a title is opened without a recent search summary and ComicK still challenges the details endpoint, the original upstream error remains visible; re-run the title search to populate the fallback cache.

The separate Comick Library API title endpoint documented under `/integrations/v1/titles/{hid}` requires OAuth `library:read` consent. It is not silently used as a public catalogue substitute, and ComicVerse does not ask for a user's Comick password or session cookie.
