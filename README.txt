ComicK route diagnostic

1. Extract this ZIP into the ComicVerse project root (merge folders).
2. Open PowerShell in the project root.
3. Run:
   cd .\apps\api
   node .\scripts\test-comick-routes.cjs

This tests the exact blank-q request used by the Admin Show All Titles button,
normal search at the UI's page size, and title/chapter/reader API routes.
It prints HTTP status, Cloudflare Ray ID, and a short response preview.
Do not share .env values, tokens, or cookies.
