# ComicVerse image upload setup

## Code changes included
- Admin comic form now accepts a cover and optional banner (JPEG/PNG/WebP/AVIF, max 10 MB each).
- The browser requests a short-lived S3/R2 PUT URL, uploads the binary, then sends the resulting object key with the comic create/update request.
- API validates image type/size at URL issuance and verifies the uploaded object exists, is within the size limit, and contains supported image bytes before saving its key.
- Creator comic submission uses the same upload flow behind the approved-creator check.
- Chapter page picker has explicit multi-file selection, accepted image extensions, selected-file handling, and clearer upload progress/error messaging. Existing chapter server validation remains enabled.

## Local development
When `NODE_ENV` is not `production` and S3/R2 credentials are not configured, chapter pages are stored locally under `apps/api/uploads`. No bucket is required for local testing. This folder is ignored by Git and the local API serves the images back to the reader.

If the API is not reachable at its default local URL, set `API_PUBLIC_URL` in `apps/api/.env` to the API's public base URL including `/api`, and keep `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` pointed at the same API.

## Production or cloud storage
Configure these values in `apps/api/.env` (or your deployment secret manager):

```env
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=comicverse-media
S3_ACCESS_KEY_ID=<R2 access key id>
S3_SECRET_ACCESS_KEY=<R2 secret access key>
CDN_BASE_URL=https://<your-public-media-domain>
```

For AWS S3, set `S3_ENDPOINT` empty and use the correct region. Do not commit real credentials.

## Required bucket CORS
Configure the R2/S3 bucket CORS policy to allow browser uploads from your actual frontend origin. Example policy (replace the origin):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-frontend.example.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The `Content-Type` sent by the browser must match the type used to request the signed URL. Do not set a public write policy; uploads use short-lived signed URLs. Production requires S3/R2; the local filesystem fallback is deliberately disabled in production.

## Apply and run
1. Extract this ZIP and copy the included `comicverse/apps/` tree over your existing `apps/` tree (or replace the listed files in-place).
2. Keep your existing `.env` values. For local testing, no S3/R2 settings are needed. For production, configure S3/R2 and bucket CORS as above.
3. Restart the API and web app.
4. In the API directory run `npm run typecheck` and `npm run build`; in the web directory run `npm run typecheck` and `npm run build`.
5. Test an admin comic cover upload, then create a draft chapter and upload multiple page images.

## Exact modified files
- `apps/web/src/components/admin/ComicForm.tsx`
- `apps/web/src/components/admin/ChapterManager.tsx`
- `apps/api/src/comics/comics.controller.ts`
- `apps/api/src/comics/comics.module.ts`
- `apps/api/src/comics/comics.service.ts`
- `apps/api/src/comics/dto/comic.dto.ts`
- `apps/api/src/creator/creator.service.ts`

The ZIP also retains the previous UI redesign files. No credentials are included or generated. Bucket CORS and valid storage credentials are deployment configuration and cannot be completed from source code alone.
