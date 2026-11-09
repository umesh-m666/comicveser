import { test } from "node:test";
import assert from "node:assert/strict";
import { AsuraScansProvider } from "./asurascans.provider";
import { loadSourcesConfig } from "./sources.config";

const config = loadSourcesConfig({ SOURCES_ENABLED: "true" });
const series = {
  id: 2064, slug: "solo-leveling-ragnarok", title: "Solo Leveling: Ragnarok",
  public_url: "/comics/solo-leveling-ragnarok-ab39de10",
  cover: "https://cdn.asurascans.com/asura-images/covers/solo-leveling.webp",
  description: "A story.", status: "ongoing", type: "manhwa",
  alt_titles: [], author: "Writer", artist: "Artist", genres: [],
};
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const htmlResponse = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html" } });

test("uses the publicly linked Asura series endpoint with offset pagination", async () => {
  let requested = "";
  const provider = new AsuraScansProvider(config, async (input, init) => {
    requested = String(input);
    assert.equal(new Headers(init?.headers).get("user-agent"), config.userAgent);
    return jsonResponse({ data: [series], meta: { total: 21, per_page: 10 } });
  });
  const result = await provider.search({ q: "solo", page: 2, limit: 10, type: "manhwa" });
  const url = new URL(requested);
  assert.equal(url.pathname, "/api/series");
  assert.equal(url.searchParams.get("search"), "solo");
  assert.equal(url.searchParams.get("offset"), "10");
  assert.equal(url.searchParams.get("type"), "manhwa");
  assert.equal(result.items[0].sourceId, "asurascans");
  assert.equal(result.hasMore, true);
});

test("resolves details from a verified series search and loads source chapter pages", async () => {
  const requests: string[] = [];
  const provider = new AsuraScansProvider(config, async (input) => {
    const url = new URL(String(input));
    requests.push(url.toString());
    if (url.hostname === "api.asurascans.com") return jsonResponse({ data: [series], meta: { total: 1, per_page: 20 } });
    if (url.pathname === "/comics/solo-leveling-ragnarok-ab39de10") {
      return htmlResponse('<a href="/comics/solo-leveling-ragnarok-ab39de10/chapter/2">Chapter 2</a><a href="/comics/solo-leveling-ragnarok-ab39de10/chapter/1">Chapter 1</a>');
    }
    return htmlResponse('<h1>Chapter 1</h1><img alt="Page 1" src="https://cdn.asurascans.com/asura-images/chapters/1.webp">');
  });
  const details = await provider.details("solo-leveling-ragnarok-ab39de10");
  assert.equal(details.title, series.title);
  const chapters = await provider.chapters(details.externalId, { language: "en", page: 1, limit: 1 });
  assert.equal(chapters.total, 2);
  assert.equal(chapters.items[0].id, "1");
  const pages = await provider.pages("1", { quality: "data" }, details.externalId);
  assert.equal(pages.pages.length, 1);
  assert.equal(pages.mangaId, details.externalId);
  assert.equal(requests.length, 3);
});
