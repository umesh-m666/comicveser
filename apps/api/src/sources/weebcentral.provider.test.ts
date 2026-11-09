import { test } from "node:test";
import assert from "node:assert/strict";
import { WeebCentralProvider } from "./weebcentral.provider";
import { loadSourcesConfig } from "./sources.config";

const config = loadSourcesConfig({ SOURCES_ENABLED: "true" });
const SERIES_ID = "01J76XY7E5E1C5Y9J0M2FCVQ8H";
const CHAPTER_ID = "01J76XYY77SY7EJ5AJ2S52JS2C";
const htmlResponse = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html" } });

test("uses WeebCentral's catalogue data endpoint for search and empty-query Show All", async () => {
  let requested = "";
  let method = "";
  const provider = new WeebCentralProvider(config, async (input, init) => {
    requested = String(input);
    method = init?.method ?? "GET";
    assert.equal(new Headers(init?.headers).get("user-agent"), config.userAgent);
    return htmlResponse(`<article data-tip="Manhwa"><a href="/series/${SERIES_ID}/Fairy-Tail"><img alt="Fairy Tail cover" src="https://temp.compsci88.com/${SERIES_ID}.webp"></a></article>`);
  }, 0);
  const result = await provider.search({ q: "", page: 1, limit: 20 });
  const url = new URL(requested);
  assert.equal(url.pathname, "/search/data");
  assert.equal(method, "GET");
  assert.equal(url.searchParams.get("text"), "");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.equal(url.searchParams.get("display_mode"), "Full Display");
  assert.equal(result.items[0].sourceId, "weebcentral");
  assert.equal(result.items[0].contentType, "manhwa");
  assert.deepEqual(provider.info().capabilities.types, ["manga", "manhwa", "manhua"]);
  await provider.search({ q: "Fairy Tail", page: 2, limit: 20 });
  assert.equal(new URL(requested).searchParams.get("offset"), "20");
});

test("loads the full chapter-list and reader-image fragments", async () => {
  const requests: string[] = [];
  const provider = new WeebCentralProvider(config, async (input) => {
    const url = new URL(String(input));
    requests.push(url.toString());
    if (url.pathname.endsWith("/full-chapter-list")) {
      return htmlResponse(`<a href="/chapters/${CHAPTER_ID}">Chapter 1</a>`);
    }
    if (url.pathname.endsWith("/images")) {
      return htmlResponse(`<meta property="og:title" content="Chapter 1 | Fairy Tail | Weeb Central"><a href="/series/${SERIES_ID}/Fairy-Tail">Fairy Tail</a><img alt="Page 1" src="https://official.lowee.us/manga/Fairy-Tail/001.png">`);
    }
    return htmlResponse(`<meta property="og:title" content="Fairy Tail | Weeb Central"><meta property="og:url" content="https://weebcentral.com/series/${SERIES_ID}/Fairy-Tail">`);
  }, 0);
  const details = await provider.details(SERIES_ID);
  const chapters = await provider.chapters(SERIES_ID, { language: "en", page: 1, limit: 500 });
  const pages = await provider.pages(CHAPTER_ID, { quality: "data" });
  assert.equal(details.title, "Fairy Tail");
  assert.equal(chapters.items[0].id, CHAPTER_ID);
  assert.equal(pages.pages.length, 1);
  assert.equal(pages.mangaId, SERIES_ID);
  assert.equal(requests[1].endsWith(`/series/${SERIES_ID}/full-chapter-list`), true);
  assert.equal(requests[2].endsWith(`/chapters/${CHAPTER_ID}/images?is_prev=False`), true);
});

test("maps a refused WeebCentral request without retrying another route", async () => {
  let requests = 0;
  const provider = new WeebCentralProvider(config, async () => {
    requests += 1;
    return new Response("Forbidden", { status: 403 });
  }, 0);
  const result = await provider.health();
  assert.equal(result.ok, false);
  assert.equal(requests, 1);
});
