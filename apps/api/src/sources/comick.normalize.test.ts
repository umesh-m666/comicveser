import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeChapters, normalizeContentType, normalizeDetails, normalizePages, normalizeSearch } from "./comick.normalize";
import {
  buildAlternativeSourceMatch,
  findMatchingSummary,
} from "./alternative.normalize";
import { SourceError } from "./provider.interface";

const comic = {
  hid: "comic-123",
  slug: "sample-comic-123",
  title: "Sample Comic",
  country: "kr",
  status: 1,
  desc: "A description.",
  year: 2024,
  lang_list: ["en", "ja"],
  md_covers: [{ b2key: "covers/sample.webp" }],
  md_titles: [{ title: "Sample Comic" }, { title: "Alternate title" }],
  md_comic_md_genres: [{ md_genres: { name: "Action" } }],
  author: [{ name: "Writer" }],
  artist: ["Artist"],
};

test("normalizes ComicK titles and preserves its provider-specific HID", () => {
  const result = normalizeSearch([comic], { q: "sample", page: 1, limit: 20 });
  assert.equal(result.items[0].externalId, "comic-123");
  assert.equal(result.items[0].sourceId, "comick");
  assert.equal(result.items[0].contentType, "manhwa");
  assert.equal(result.items[0].coverUrl, "https://meo.comick.pictures/covers/sample.webp");
  assert.deepEqual(result.items[0].alternativeTitles, ["Alternate title"]);
  assert.equal(result.totalExact, true);
  assert.equal(result.hasMore, false);
});

test("maps ComicK country codes (including cn) to supported content types", () => {
  assert.equal(normalizeContentType("jp"), "manga");
  assert.equal(normalizeContentType("kr"), "manhwa");
  assert.equal(normalizeContentType("cn"), "manhua");
  assert.equal(normalizeContentType("zh"), "manhua");
  assert.equal(normalizeContentType("zh-hk"), "manhua");
  assert.equal(normalizeContentType("unknown"), "unknown");
});

test("normalizes details without fabricating metadata and defaults availableLanguages to en when lang_list is absent", () => {
  const result = normalizeDetails({ comic }, "comic-123");
  assert.equal(result.sourceId, "comick");
  assert.equal(result.sourceUrl, "https://comick.dev/comic/sample-comic-123");
  assert.deepEqual(result.alternativeTitles, ["Alternate title"]);
  assert.deepEqual(result.authors, ["Writer"]);
  assert.deepEqual(result.artists, ["Artist"]);
  assert.deepEqual(result.availableLanguages, ["en", "ja"]);
  assert.equal(result.description, "A description.");
  assert.equal(result.year, 2024);
  const minimal = normalizeDetails({ comic: { ...comic, author: undefined, desc: undefined, year: undefined, lang_list: undefined } }, "comic-123");
  assert.equal(minimal.description, null);
  assert.deepEqual(minimal.availableLanguages, ["en"]);
});

test("normalizes paginated chapters, maps gb to en, and deduplicates stable chapter HIDs", () => {
  const response = normalizeChapters({
    total: 3,
    chapters: [
      { hid: "chapter-1", chap: "1", title: "First", lang: "en", group_name: ["Group A"], created_at: "2026-01-01T00:00:00Z" },
      { hid: "chapter-1", chap: "1", title: "Duplicate", lang: "en" },
      { hid: "chapter-ja", chap: "1", lang: "ja" },
      { hid: "chapter-2", chap: "2.5", title: "Second", lang: "gb", md_chapters_groups: [{ md_groups: { title: "Group B" } }] },
    ],
  }, "comic-123", "en", 1, 2);
  assert.equal(response.total, 3);
  assert.equal(response.hasMore, true);
  assert.deepEqual(response.items.map((item) => item.id), ["chapter-1", "chapter-2"]);
  assert.equal(response.items[0].sourceId, "comick");
  assert.deepEqual(response.items[0].groups, ["Group A"]);
  assert.deepEqual(response.items[1].groups, ["Group B"]);
  assert.equal(response.items[1].number, 2.5);
});

test("keeps rows returned for a later upstream page and accepts plain chapter arrays", () => {
  const response = normalizeChapters([
    { hid: "chapter-21", chap: "21", lang: "en" },
    { hid: "chapter-22", chap: "22", lang: "en" },
  ], "comic-123", "en", 2, 2);
  assert.deepEqual(response.items.map((item) => item.id), ["chapter-21", "chapter-22"]);
  assert.equal(response.hasMore, true);
  assert.equal(response.page, 2);
  assert.equal(response.limit, 2);
});

test("returns a complete ordered page list, supporting string image arrays and *.comick.pictures hosts", () => {
  const images: unknown[] = Array.from({ length: 300 }, (_, index) =>
    index === 0 ? "pages/1.webp" : { b2key: `https://meo3.comick.pictures/pages/${index + 1}.webp`, w: 800, h: 1200 }
  );
  images.splice(3, 0, images[1]);
  images.push({ b2key: "https://untrusted.example/page.webp", w: 100, h: 200 });
  const result = normalizePages({
    chapter: {
      hid: "chapter-1",
      chap: "1",
      lang: "en",
      group_name: ["Group A"],
      md_comics: { hid: "comic-123" },
      md_images: images,
    },
  }, "chapter-1", "comic-123");
  assert.equal(result.pages.length, 300);
  assert.equal(result.pages[0].pageNumber, 1);
  assert.equal(result.pages[0].imageUrl, "https://meo.comick.pictures/pages/1.webp");
  assert.equal(result.pages[1].imageUrl, "https://meo3.comick.pictures/pages/2.webp");
  assert.equal(result.pages[299].pageNumber, 300);
  assert.equal(result.pages[1].width, 800);
  assert.deepEqual(result.groups, ["Group A"]);
});

test("accepts a valid chapter metadata payload without md_images and rejects malformed or cross-manga pages", () => {
  assert.deepEqual(normalizePages({ chapter: { hid: "chapter-1", md_images: [] } }, "chapter-1").pages, []);
  assert.deepEqual(normalizePages({ chapter: { hid: "chapter-1", chap: "1" } }, "chapter-1").pages, []);
  assert.throws(() => normalizePages({ chapter: {} }, "chapter-1"), (error) => error instanceof SourceError && error.code === "BAD_RESPONSE");
  assert.throws(() => normalizePages({ chapter: { hid: "chapter-2", md_images: [] } }, "chapter-1"), (error) => error instanceof SourceError && error.code === "NOT_FOUND");
  assert.throws(() => normalizePages({ chapter: { hid: "chapter-1", md_comics: { hid: "another-comic" }, md_images: [] } }, "chapter-1", "comic-123"), (error) => error instanceof SourceError && error.code === "NOT_FOUND");
});

test("rejects malformed search responses and mismatched detail IDs", () => {
  assert.throws(() => normalizeSearch({ results: [] }, { q: "sample", page: 1, limit: 20 }), (error) => error instanceof SourceError && error.code === "BAD_RESPONSE");
  assert.throws(() => normalizeDetails({ comic }, "other-comic"), (error) => error instanceof SourceError && error.code === "BAD_RESPONSE");
});

test("matches alternative sources on WeebCentral and Asura Scans while strictly preserving their own manga IDs, chapter IDs, and reader URLs", () => {
  const wcCandidates = [
    {
      id: "wc-01J76XY",
      externalId: "wc-01J76XY",
      sourceId: "weebcentral",
      title: "The God Who Became My Father",
      alternativeTitles: [],
      coverUrl: null,
      description: null,
      status: "ongoing",
      genres: [],
      contentType: "manhwa" as const,
      language: "en",
      sourceUrl: "https://weebcentral.com/series/wc-01J76XY",
    },
  ];
  const matchedWc = findMatchingSummary(wcCandidates, ["The God Who Became My Father"]);
  assert.ok(matchedWc);

  const wcMatch = buildAlternativeSourceMatch(
    "weebcentral",
    "WeebCentral",
    matchedWc,
    {
      items: [
        {
          id: "wc-chap-001",
          sourceId: "weebcentral",
          mangaId: "wc-01J76XY",
          number: 1,
          numberLabel: "1",
          title: "Prologue",
          volume: null,
          language: "en",
          publishedAt: null,
          groups: ["WeebCentral"],
          pageCount: 18,
          sourceUrl: "https://weebcentral.com/chapters/wc-chap-001",
          duplicateNumber: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 500,
      hasMore: false,
    },
    "en",
    "1",
    1,
  );

  assert.equal(wcMatch.sourceId, "weebcentral");
  assert.equal(wcMatch.externalId, "wc-01J76XY");
  assert.equal(wcMatch.catalogUrl, "/sources/weebcentral/wc-01J76XY");
  assert.equal(wcMatch.matchedChapter?.id, "wc-chap-001");
  assert.equal(wcMatch.matchedChapter?.sourceId, "weebcentral");
  assert.equal(wcMatch.matchedChapter?.mangaId, "wc-01J76XY");
  assert.equal(wcMatch.matchedChapter?.readerUrl, "/sources/weebcentral/wc-01J76XY/read/wc-chap-001?lang=en");

  const asuraItem = {
    id: "asura-god-father-99",
    externalId: "asura-god-father-99",
    sourceId: "asurascans",
    title: "The God Who Became My Father",
    alternativeTitles: [],
    coverUrl: null,
    description: null,
    status: "ongoing",
    genres: [],
    contentType: "manhwa" as const,
    language: "en",
    sourceUrl: "https://asuracomic.net/series/asura-god-father-99",
  };
  const asuraMatch = buildAlternativeSourceMatch(
    "asurascans",
    "Asura Scans",
    asuraItem,
    {
      items: [
        {
          id: "asura-god-father-99/chapter/1",
          sourceId: "asurascans",
          mangaId: "asura-god-father-99",
          number: 1,
          numberLabel: "1",
          title: "Chapter 1",
          volume: null,
          language: "en",
          publishedAt: null,
          groups: ["Asura Scans"],
          pageCount: 22,
          sourceUrl: "https://asuracomic.net/series/asura-god-father-99/chapter/1",
          duplicateNumber: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 500,
      hasMore: false,
    },
    "en",
    "1",
    1,
  );

  assert.equal(asuraMatch.sourceId, "asurascans");
  assert.equal(asuraMatch.externalId, "asura-god-father-99");
  assert.equal(asuraMatch.matchedChapter?.id, "asura-god-father-99/chapter/1");
  assert.equal(asuraMatch.matchedChapter?.sourceId, "asurascans");
  assert.equal(asuraMatch.matchedChapter?.mangaId, "asura-god-father-99");
  assert.equal(asuraMatch.matchedChapter?.readerUrl, "/sources/asurascans/asura-god-father-99/read/asura-god-father-99%2Fchapter%2F1?lang=en");
});
