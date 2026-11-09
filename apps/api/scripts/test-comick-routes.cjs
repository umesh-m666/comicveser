// Run from apps/api: node scripts/test-comick-routes.cjs
// This probes the same public paths used by ComicVerse, including the blank-q
// request emitted by the Admin "Show All Titles" button.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const API = 'https://api.comick.dev';
const USER_AGENT = process.env.SOURCES_USER_AGENT || 'ComicVerse/1.0 (+http://localhost:3000)';
const TIMEOUT_MS = Number(process.env.SOURCES_TIMEOUT_MS || 10000);

function makeUrl(route, params = {}) {
  const url = new URL(route, API);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
}

async function probe(label, url) {
  console.log(`\n--- ${label} ---`);
  console.log(url.toString());
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://comick.dev/',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await response.text();
    console.log(`HTTP ${response.status} ${response.statusText}`);
    console.log(`Server: ${response.headers.get('server') || '(none)'}`);
    console.log(`CF-Ray: ${response.headers.get('cf-ray') || '(none)'}`);
    console.log(`Body: ${body.replace(/\s+/g, ' ').slice(0, 420)}`);
    let json = null;
    try { json = JSON.parse(body); } catch {}
    return { status: response.status, json };
  } catch (error) {
    console.log(`FETCH ERROR: ${error.name}: ${error.message}`);
    if (error.cause) console.log(`CAUSE: ${error.cause.code || ''} ${error.cause.message || ''}`);
    return { status: 0, json: null };
  }
}

(async () => {
  console.log(`Node: ${process.version}`);
  console.log(`User-Agent: ${USER_AGENT}`);
  console.log(`Timeout: ${TIMEOUT_MS} ms`);

  // Exact request from SourceCatalog.tsx when the user clicks Show All Titles.
  await probe('UI Show All Titles (no type filter, q is blank)', makeUrl('/v1.0/search', { q: '', page: 1, limit: 20 }));
  await probe('UI Show All Titles (Manga filter, q is blank)', makeUrl('/v1.0/search', { q: '', page: 1, limit: 20, country: 'jp' }));
  await probe('UI Show All Titles (Manhwa filter, q is blank)', makeUrl('/v1.0/search', { q: '', page: 1, limit: 20, country: 'kr' }));
  await probe('UI Show All Titles (Manhua filter, q is blank)', makeUrl('/v1.0/search', { q: '', page: 1, limit: 20, country: 'zh' }));

  // Same search request with a real term; the earlier user's probe tested limit=1.
  const search = await probe('UI normal search (Naruto, page size 20)', makeUrl('/v1.0/search', { q: 'naruto', page: 1, limit: 20 }));
  const title = Array.isArray(search.json) ? search.json.find((row) => row && row.hid) : null;
  const titleHid = title?.hid || '1J46csio';
  console.log(`\nTitle HID selected for detail/chapter probes: ${titleHid}`);

  await probe('Title details route used by ComicVerse', makeUrl(`/comic/${encodeURIComponent(titleHid)}`));
  const chapters = await probe('Chapter list route used by ComicVerse', makeUrl(`/comic/${encodeURIComponent(titleHid)}/chapters`, { page: 1, limit: 20, lang: 'en' }));
  const chapterRows = Array.isArray(chapters.json) ? chapters.json : Array.isArray(chapters.json?.chapters) ? chapters.json.chapters : [];
  const chapterHid = chapterRows.find((row) => row && row.hid)?.hid;
  if (chapterHid) {
    await probe('Chapter pages metadata route used by ComicVerse', makeUrl(`/chapter/${encodeURIComponent(chapterHid)}`));
  } else {
    console.log('\n--- Chapter pages metadata route ---');
    console.log('Skipped: chapter list response did not contain a chapter HID.');
  }
  console.log('\nDone. Compare each HTTP status. A 403 on one route identifies the specific ComicK path blocked by its edge layer.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
