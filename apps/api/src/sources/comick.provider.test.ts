import { test } from "node:test";
import assert from "node:assert/strict";
import { ComicKProvider } from "./comick.provider";
import { SourceError } from "./provider.interface";
import { loadSourcesConfig } from "./sources.config";

const config = loadSourcesConfig({ SOURCES_ENABLED: "true" });
const comic = {
  hid: "comic-123",
  slug: "sample-comic-123",
  title: "Sample Comic",
  country: "jp",
  status: 2,
  desc: "A description.",
  lang_list: ["en"],
};
const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers });

test("uses the referenced ComicK search endpoint with app-identifying headers", async () => {
  let requested = "";
  const provider = new ComicKProvider(config, async (input, init) => {
    requested = String(input);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("user-agent"), config.userAgent);
    assert.equal(headers.get("referer"), "https://comick.dev/");
    assert.equal(headers.get("origin"), null);
    assert.match(headers.get("accept") ?? "", /application\/json/);
    return jsonResponse([comic]);
  });
  const result = await provider.search({ q: "sample", type: "manga", page: 2, limit: 20 });
  const url = new URL(requested);
  assert.equal(url.hostname, "api.comick.dev");
  assert.equal(url.pathname, "/v1.0/search");
  assert.equal(url.searchParams.get("q"), "sample");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("country"), "jp");
  assert.equal(result.items[0].externalId, "comic-123");
  assert.equal(result.total, 21);
  assert.equal(result.totalExact, true);
});

test("loads details and paginated language-specific chapters by ComicK HIDs", async () => {
  const requests: string[] = [];
  const provider = new ComicKProvider(config, async (input) => {
    const url = new URL(String(input));
    requests.push(url.toString());
    if (url.pathname === "/comic/comic-123") return jsonResponse({ comic });
    if (url.pathname === "/comic/comic-123/chapters") {
      return jsonResponse({
        total: 548,
        chapters: [{ hid: "chapter-1", chap: "1", lang: "en", group_name: ["Group A"] }],
      });
    }
    return jsonResponse({ chapter: { hid: "chapter-1", md_images: [] } });
  });
  const details = await provider.details("comic-123");
  const chapters = await provider.chapters("comic-123", { language: "en", page: 2, limit: 500 });
  assert.equal(details.externalId, "comic-123");
  assert.equal(details.sourceId, "comick");
  assert.equal(chapters.total, 548);
  assert.equal(chapters.hasMore, true);
  assert.equal(chapters.items.length, 1, "keep the rows ComicK returned for page 2");
  assert.equal(chapters.items[0].id, "chapter-1");
  const chapterUrl = new URL(requests[1]);
  assert.equal(chapterUrl.searchParams.get("page"), "2");
  assert.equal(chapterUrl.searchParams.get("limit"), "20");
  assert.equal(chapterUrl.searchParams.get("lang"), "en");
});

test("retrieves the complete page list without adding provider-specific reader URL logic", async () => {
  const images = Array.from({ length: 250 }, (_, index) => ({ b2key: `pages/${index + 1}.webp` }));
  let requested = "";
  const provider = new ComicKProvider(config, async (input) => {
    requested = String(input);
    return jsonResponse({ chapter: { hid: "chapter-1", chap: "1", md_comics: { hid: "comic-123" }, md_images: images } });
  });
  const result = await provider.pages("chapter-1", { quality: "data" }, "comic-123");
  assert.equal(new URL(requested).pathname, "/chapter/chapter-1");
  assert.equal(new URL(requested).search, "");
  assert.equal(result.pages.length, 250);
  assert.equal(result.pages[249].pageNumber, 250);
  assert.equal(result.mangaId, "comic-123");
});

test("coalesces concurrent requests and converts rate limits to source errors", async () => {
  let requests = 0;
  const provider = new ComicKProvider(config, async () => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return jsonResponse({ comic });
  });
  await Promise.all([provider.details("comic-123"), provider.details("comic-123")]);
  assert.equal(requests, 1);

  const limited = new ComicKProvider(config, async () => jsonResponse({}, 429, { "retry-after": "30" }));
  await assert.rejects(() => limited.details("comic-123"), (error) => error instanceof SourceError && error.code === "SOURCE_RATE_LIMITED" && error.retryAfterSeconds === 30);
});

test("preserves diagnostic details for 401 and 403 upstream refusals", async () => {
  const unauthorized = new ComicKProvider(config, async () => new Response("Unauthorized", { status: 401 }));
  await assert.rejects(() => unauthorized.details("comic-123"), (error) => error instanceof SourceError && error.code === "SOURCE_UNAVAILABLE" && /HTTP 401/.test(error.message) && /should not need a Comick login/.test(error.message));

  const forbidden = new ComicKProvider(config, async () => new Response("Just a moment... Cloudflare", { status: 403, headers: { server: "cloudflare", "cf-ray": "test-ray" } }));
  await assert.rejects(() => forbidden.details("comic-123"), (error) => error instanceof SourceError && error.code === "SOURCE_UNAVAILABLE" && /HTTP 403/.test(error.message) && /Cloudflare/.test(error.message) && /test-ray/.test(error.message));
});

test("uses recent search metadata when ComicK Cloudflare-challenges the details endpoint", async () => {
  const requested: string[] = [];
  const provider = new ComicKProvider(config, async (input) => {
    const url = new URL(String(input));
    requested.push(url.pathname);
    if (url.pathname === "/v1.0/search") return jsonResponse([{ ...comic, md_titles: [{ title: "Sample Alt Title" }] }]);
    return new Response("Just a moment... Enable JavaScript and cookies to continue", {
      status: 403,
      headers: { server: "cloudflare", "cf-ray": "fallback-test-ray" },
    });
  });

  const search = await provider.search({ q: "sample", page: 1, limit: 20 });
  const details = await provider.details("comic-123");

  assert.deepEqual(requested, ["/v1.0/search", "/comic/comic-123"]);
  assert.equal(details.externalId, "comic-123");
  assert.equal(details.title, "Sample Comic");
  assert.equal(details.metadataFallback, "search");
  assert.equal(details.availableLanguages[0], "en");
  assert.deepEqual(details.authors, []);
  assert.deepEqual(details.artists, []);
  assert.equal(details.year, null);
  assert.equal(search.items[0].title, details.title);
});

test("maps an upstream 522 to unavailable and rejects invalid IDs and unsupported types", async () => {
  const unavailable = new ComicKProvider(config, async () => new Response("Origin error", { status: 522 }));
  await assert.rejects(() => unavailable.details("comic-123"), (error) => error instanceof SourceError && error.code === "SOURCE_UNAVAILABLE" && /HTTP 522/.test(error.message));
  await assert.rejects(() => unavailable.details("../comic"), (error) => error instanceof SourceError && error.code === "INVALID_REQUEST");
  await assert.rejects(() => unavailable.search({ q: "sample", type: "novel", page: 1, limit: 20 }), (error) => error instanceof SourceError && error.code === "INVALID_REQUEST");
});
