import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeChapters, normalizeDetails, normalizePages, normalizeSearch } from "./asurascans.normalize";

const series = {
  id: 2064,
  slug: "solo-leveling-ragnarok",
  title: "Solo Leveling: Ragnarok",
  public_url: "/comics/solo-leveling-ragnarok-ab39de10",
  cover: "https://cdn.asurascans.com/asura-images/covers/solo-leveling.webp",
  description: "An <p>adventure</p>.",
  status: "ongoing",
  type: "manhwa",
  alt_titles: ["Solo Leveling Ragnarok"],
  author: "Dangdo",
  artist: "Redice Studio",
  genres: [{ name: "Action" }],
};

test("normalizes Asura series metadata and preserves the canonical external id", () => {
  const search = normalizeSearch({ data: [series], meta: { total: 25, per_page: 20 } }, { q: "solo", page: 1, limit: 20 });
  assert.equal(search.items[0].externalId, "solo-leveling-ragnarok-ab39de10");
  assert.equal(search.items[0].coverUrl, series.cover);
  assert.equal(search.items[0].description, "An adventure .");
  assert.equal(search.items[0].contentType, "manhwa");
  assert.equal(search.total, 25);
  assert.equal(search.hasMore, true);

  const details = normalizeDetails(series);
  assert.deepEqual(details.authors, ["Dangdo"]);
  assert.deepEqual(details.artists, ["Redice Studio"]);
  assert.deepEqual(details.availableLanguages, ["en"]);
});

test("paginates all 548 Asura chapters without truncating at the initial 500", () => {
  const mangaId = "solo-leveling-ragnarok-ab39de10";
  const html = Array.from({ length: 548 }, (_, index) => {
    const number = 548 - index;
    return `<a href="/comics/${mangaId}/chapter/${number}">Chapter ${number}</a>`;
  }).join("") + '<a href="/comics/other-title/chapter/9">Chapter 9</a>';
  const first = normalizeChapters(html, mangaId, 1, 500);
  const second = normalizeChapters(html, mangaId, 2, 500);
  assert.equal(first.items.length, 500);
  assert.equal(first.items[0].id, "1");
  assert.equal(first.items.at(-1)?.id, "500");
  assert.equal(first.total, 548);
  assert.equal(first.hasMore, true);
  assert.equal(second.items.length, 48);
  assert.equal(second.items[0].id, "501");
  assert.equal(second.items.at(-1)?.id, "548");
  assert.equal(second.hasMore, false);
});

test("normalizes only ordered chapter images from Asura's CDN", () => {
  const images = Array.from({ length: 29 }, (_, index) => {
    const number = index + 1;
    return `<img alt="Page ${number}" width="800" height="1200" src="https://cdn.asurascans.com/asura-images/chapters/${number}.webp">`;
  }).join("");
  const html = [
    '<h1>Chapter 12</h1>',
    images,
    '<img alt="Page 3" src="https://evil.example/asura-images/chapters/3.webp">',
    '<img alt="Advertisement" src="https://cdn.asurascans.com/asura-images/ads/ad.webp">',
  ].join("");
  const result = normalizePages(html, "solo-leveling-ragnarok-ab39de10", "12");
  assert.equal(result.pages.length, 29);
  assert.deepEqual(result.pages.map((page) => page.pageNumber), Array.from({ length: 29 }, (_, index) => index + 1));
  assert.equal(result.pages[1].width, 800);
  assert.equal(result.chapterNumber, "12");
  assert.equal(result.sourceUrl, "https://asurascans.com/comics/solo-leveling-ragnarok-ab39de10/chapter/12");
});

test("PART 3: AsuraScans chapter normalization extracts release dates, keeps missing release dates null, detects duplicates, and orders chapters", () => {
  const mangaId = "return-of-the-iron-blooded-sword-hound";
  const html = [
    `<a href="/comics/${mangaId}/chapter/188"><h3>Chapter 188 - Blood Hound</h3><h3>November 10th 2026</h3></a>`,
    `<a href="/comics/${mangaId}/chapter/187.5"><span>Chapter 187.5</span><time datetime="2026-11-05T12:00:00Z">Nov 5, 2026</time></a>`,
    `<a href="/comics/${mangaId}/chapter/187"><span>Chapter 187</span></a>`,
    `<a href="/comics/${mangaId}/chapter/187-alt"><span>Chapter 187</span><span>2026-11-01</span></a>`,
  ].join("");

  const result = normalizeChapters(html, mangaId, 1, 50);
  assert.equal(result.items.length, 4);
  assert.deepEqual(
    result.items.map((i) => i.number),
    [187, 187, 187.5, 188],
  );
  // Duplicate detection for Chapter 187
  assert.equal(result.items[0].duplicateNumber, true);
  assert.equal(result.items[1].duplicateNumber, true);
  assert.equal(result.items[2].duplicateNumber, false);
  assert.equal(result.items[3].duplicateNumber, false);

  // Missing release date stays null (never invented)
  const ch187NoDate = result.items.find((i) => i.id === "187")!;
  assert.equal(ch187NoDate.publishedAt, null);

  // Explicit ISO date
  const ch187Alt = result.items.find((i) => i.id === "187-alt")!;
  assert.equal(ch187Alt.publishedAt, "2026-11-01T00:00:00.000Z");

  // <time datetime> attribute
  const ch187Half = result.items.find((i) => i.id === "187.5")!;
  assert.equal(ch187Half.publishedAt, "2026-11-05T12:00:00.000Z");

  // Human-readable date with ordinal ("November 10th 2026") + subtitle extraction
  const ch188 = result.items.find((i) => i.id === "188")!;
  assert.equal(ch188.number, 188);
  assert.equal(ch188.numberLabel, "188");
  assert.equal(ch188.title, "Blood Hound");
  assert.equal(ch188.publishedAt, "2026-11-10T00:00:00.000Z");
});
