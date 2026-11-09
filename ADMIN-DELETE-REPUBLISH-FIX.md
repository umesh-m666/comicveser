# Fix: deleting and publishing a provider title again

## Root cause

Provider-published comics are linked to a unique `SourceTitle` row. Comic Management used a soft delete (`Comic.deletedAt` + `publishState = ARCHIVED`) but kept that row linked. As a result:

- the provider catalogue continued to mark the title as already approved;
- a new approval hit the "already linked" conflict;
- old chapter mappings remained attached to the stale `SourceTitle` row;
- the older republish operation could set `publishState = PUBLISHED` without clearing `deletedAt`, so public queries still hid the comic.

## Changed files

- `apps/api/src/comics/comics.service.ts`
  - Deleting a source-backed Comic now detaches its `SourceTitle` row in the same transaction.
  - Related `SourceChapter` mapping rows are removed by the existing database `ON DELETE CASCADE`; the archived Comic and Chapter records are retained.
  - Public home-page list caches are invalidated after deletion.

- `apps/api/src/sources/sources.service.ts`
  - Provider catalogue and inspect data treat stale approval rows whose Comic is deleted or missing as awaiting review.
  - Approve/reject cleans up stale mappings left by the older behavior before creating a new review record.
  - Republish clears a stale `deletedAt` marker so a successful republish cannot remain hidden.

The generated API runtime files in `apps/api/dist/` were also updated to match the two TypeScript source files.

## Apply

1. Back up the current project.
2. Use the updated project ZIP, or replace the two source files above and their corresponding `dist/` JavaScript files from the changed-files ZIP.
3. For production, run `npm ci` and `npm run build` from `apps/api` before restarting the API. For development, restart `npm run start:dev`.
4. No Prisma schema change or database migration is required.
5. Open the relevant provider catalogue and search for the previously deleted title. It should appear as awaiting review. Click **Approve & publish**.

## Verification

- Both modified TypeScript files passed TypeScript transpile/syntax checks.
- Both updated runtime JavaScript files passed `node --check`.
- A full API typecheck/build could not be run in this environment because project dependencies (including NestJS and the generated Prisma Client) are not installed in the extracted archive.
