# WeebCentral catalogue / Show All fix

## Files changed

- `apps/api/src/sources/weebcentral.provider.ts`
- `apps/api/src/sources/weebcentral.normalize.ts`
- `apps/api/src/sources/weebcentral.provider.test.ts`
- `apps/api/src/sources/weebcentral.normalize.test.ts`
- Compiled production files under `apps/api/dist/sources/` for the two WeebCentral modules and the source query DTO.

## What changed

- Replaced WeebCentral's quick-search fragment request with its advanced catalogue page (`GET /search`).
- Sends `text`, `limit`, `offset`, and `display_mode=Full Display`, so an empty `text` can request the provider's default catalogue and subsequent pages use offset pagination.
- Parses series cards from list/article markup, including IDs, title, cover and Manga/Manhwa/Manhua type labels.
- Advertises all three supported content types to the admin provider UI.
- Reads the title's type from its details page during approval, with the legacy Manga fallback only when the upstream page omits a type label.
- Keeps the previous DTO empty-query validation (`Length(0, 100)`) and writes the compiled DTO too, to prevent production mode from running an outdated validator.
- Does not change Comic delete/republish workflow or other providers.

## Install

Copy the files from this update into the same paths in your project. Then, from `apps/api`, run:

```bash
npm run build
```

Restart the API. `npm run start:dev` uses source TypeScript; `npm run start:prod` uses the compiled `dist` folder.

## Verification

The WeebCentral provider and normalizer tests were transpiled and run with Node's test runner: 7 tests passed. The full NestJS project build was not run because dependencies were not installed in this environment. Actual upstream availability still depends on WeebCentral responding to the public catalogue request and its current HTML structure.
