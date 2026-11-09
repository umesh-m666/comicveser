"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const comick_normalize_1 = require("./comick.normalize");
const alternative_normalize_1 = require("./alternative.normalize");
const provider_interface_1 = require("./provider.interface");
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
(0, node_test_1.test)("normalizes ComicK titles and preserves its provider-specific HID", () => {
    const result = (0, comick_normalize_1.normalizeSearch)([comic], { q: "sample", page: 1, limit: 20 });
    strict_1.default.equal(result.items[0].externalId, "comic-123");
    strict_1.default.equal(result.items[0].sourceId, "comick");
    strict_1.default.equal(result.items[0].contentType, "manhwa");
    strict_1.default.equal(result.items[0].coverUrl, "https://meo.comick.pictures/covers/sample.webp");
    strict_1.default.deepEqual(result.items[0].alternativeTitles, ["Alternate title"]);
    strict_1.default.equal(result.totalExact, true);
    strict_1.default.equal(result.hasMore, false);
});
(0, node_test_1.test)("maps ComicK country codes (including cn) to supported content types", () => {
    strict_1.default.equal((0, comick_normalize_1.normalizeContentType)("jp"), "manga");
    strict_1.default.equal((0, comick_normalize_1.normalizeContentType)("kr"), "manhwa");
    strict_1.default.equal((0, comick_normalize_1.normalizeContentType)("cn"), "manhua");
    strict_1.default.equal((0, comick_normalize_1.normalizeContentType)("zh"), "manhua");
    strict_1.default.equal((0, comick_normalize_1.normalizeContentType)("zh-hk"), "manhua");
    strict_1.default.equal((0, comick_normalize_1.normalizeContentType)("unknown"), "unknown");
});
(0, node_test_1.test)("normalizes details without fabricating metadata and defaults availableLanguages to en when lang_list is absent", () => {
    const result = (0, comick_normalize_1.normalizeDetails)({ comic }, "comic-123");
    strict_1.default.equal(result.sourceId, "comick");
    strict_1.default.equal(result.sourceUrl, "https://comick.dev/comic/sample-comic-123");
    strict_1.default.deepEqual(result.alternativeTitles, ["Alternate title"]);
    strict_1.default.deepEqual(result.authors, ["Writer"]);
    strict_1.default.deepEqual(result.artists, ["Artist"]);
    strict_1.default.deepEqual(result.availableLanguages, ["en", "ja"]);
    strict_1.default.equal(result.description, "A description.");
    strict_1.default.equal(result.year, 2024);
    const minimal = (0, comick_normalize_1.normalizeDetails)({ comic: { ...comic, author: undefined, desc: undefined, year: undefined, lang_list: undefined } }, "comic-123");
    strict_1.default.equal(minimal.description, null);
    strict_1.default.deepEqual(minimal.availableLanguages, ["en"]);
});
(0, node_test_1.test)("normalizes paginated chapters, maps gb to en, and deduplicates stable chapter HIDs", () => {
    const response = (0, comick_normalize_1.normalizeChapters)({
        total: 3,
        chapters: [
            { hid: "chapter-1", chap: "1", title: "First", lang: "en", group_name: ["Group A"], created_at: "2026-01-01T00:00:00Z" },
            { hid: "chapter-1", chap: "1", title: "Duplicate", lang: "en" },
            { hid: "chapter-ja", chap: "1", lang: "ja" },
            { hid: "chapter-2", chap: "2.5", title: "Second", lang: "gb", md_chapters_groups: [{ md_groups: { title: "Group B" } }] },
        ],
    }, "comic-123", "en", 1, 2);
    strict_1.default.equal(response.total, 3);
    strict_1.default.equal(response.hasMore, true);
    strict_1.default.deepEqual(response.items.map((item) => item.id), ["chapter-1", "chapter-2"]);
    strict_1.default.equal(response.items[0].sourceId, "comick");
    strict_1.default.deepEqual(response.items[0].groups, ["Group A"]);
    strict_1.default.deepEqual(response.items[1].groups, ["Group B"]);
    strict_1.default.equal(response.items[1].number, 2.5);
});
(0, node_test_1.test)("keeps rows returned for a later upstream page and accepts plain chapter arrays", () => {
    const response = (0, comick_normalize_1.normalizeChapters)([
        { hid: "chapter-21", chap: "21", lang: "en" },
        { hid: "chapter-22", chap: "22", lang: "en" },
    ], "comic-123", "en", 2, 2);
    strict_1.default.deepEqual(response.items.map((item) => item.id), ["chapter-21", "chapter-22"]);
    strict_1.default.equal(response.hasMore, true);
    strict_1.default.equal(response.page, 2);
    strict_1.default.equal(response.limit, 2);
});
(0, node_test_1.test)("returns a complete ordered page list, supporting string image arrays and *.comick.pictures hosts", () => {
    const images = Array.from({ length: 300 }, (_, index) => index === 0 ? "pages/1.webp" : { b2key: `https://meo3.comick.pictures/pages/${index + 1}.webp`, w: 800, h: 1200 });
    images.splice(3, 0, images[1]);
    images.push({ b2key: "https://untrusted.example/page.webp", w: 100, h: 200 });
    const result = (0, comick_normalize_1.normalizePages)({
        chapter: {
            hid: "chapter-1",
            chap: "1",
            lang: "en",
            group_name: ["Group A"],
            md_comics: { hid: "comic-123" },
            md_images: images,
        },
    }, "chapter-1", "comic-123");
    strict_1.default.equal(result.pages.length, 300);
    strict_1.default.equal(result.pages[0].pageNumber, 1);
    strict_1.default.equal(result.pages[0].imageUrl, "https://meo.comick.pictures/pages/1.webp");
    strict_1.default.equal(result.pages[1].imageUrl, "https://meo3.comick.pictures/pages/2.webp");
    strict_1.default.equal(result.pages[299].pageNumber, 300);
    strict_1.default.equal(result.pages[1].width, 800);
    strict_1.default.deepEqual(result.groups, ["Group A"]);
});
(0, node_test_1.test)("accepts a valid chapter metadata payload without md_images and rejects malformed or cross-manga pages", () => {
    strict_1.default.deepEqual((0, comick_normalize_1.normalizePages)({ chapter: { hid: "chapter-1", md_images: [] } }, "chapter-1").pages, []);
    strict_1.default.deepEqual((0, comick_normalize_1.normalizePages)({ chapter: { hid: "chapter-1", chap: "1" } }, "chapter-1").pages, []);
    strict_1.default.throws(() => (0, comick_normalize_1.normalizePages)({ chapter: {} }, "chapter-1"), (error) => error instanceof provider_interface_1.SourceError && error.code === "BAD_RESPONSE");
    strict_1.default.throws(() => (0, comick_normalize_1.normalizePages)({ chapter: { hid: "chapter-2", md_images: [] } }, "chapter-1"), (error) => error instanceof provider_interface_1.SourceError && error.code === "NOT_FOUND");
    strict_1.default.throws(() => (0, comick_normalize_1.normalizePages)({ chapter: { hid: "chapter-1", md_comics: { hid: "another-comic" }, md_images: [] } }, "chapter-1", "comic-123"), (error) => error instanceof provider_interface_1.SourceError && error.code === "NOT_FOUND");
});
(0, node_test_1.test)("rejects malformed search responses and mismatched detail IDs", () => {
    strict_1.default.throws(() => (0, comick_normalize_1.normalizeSearch)({ results: [] }, { q: "sample", page: 1, limit: 20 }), (error) => error instanceof provider_interface_1.SourceError && error.code === "BAD_RESPONSE");
    strict_1.default.throws(() => (0, comick_normalize_1.normalizeDetails)({ comic }, "other-comic"), (error) => error instanceof provider_interface_1.SourceError && error.code === "BAD_RESPONSE");
});
(0, node_test_1.test)("matches alternative sources on WeebCentral and Asura Scans while strictly preserving their own manga IDs, chapter IDs, and reader URLs", () => {
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
            contentType: "manhwa",
            language: "en",
            sourceUrl: "https://weebcentral.com/series/wc-01J76XY",
        },
    ];
    const matchedWc = (0, alternative_normalize_1.findMatchingSummary)(wcCandidates, ["The God Who Became My Father"]);
    strict_1.default.ok(matchedWc);
    const wcMatch = (0, alternative_normalize_1.buildAlternativeSourceMatch)("weebcentral", "WeebCentral", matchedWc, {
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
    }, "en", "1", 1);
    strict_1.default.equal(wcMatch.sourceId, "weebcentral");
    strict_1.default.equal(wcMatch.externalId, "wc-01J76XY");
    strict_1.default.equal(wcMatch.catalogUrl, "/sources/weebcentral/wc-01J76XY");
    strict_1.default.equal(wcMatch.matchedChapter?.id, "wc-chap-001");
    strict_1.default.equal(wcMatch.matchedChapter?.sourceId, "weebcentral");
    strict_1.default.equal(wcMatch.matchedChapter?.mangaId, "wc-01J76XY");
    strict_1.default.equal(wcMatch.matchedChapter?.readerUrl, "/sources/weebcentral/wc-01J76XY/read/wc-chap-001?lang=en");
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
        contentType: "manhwa",
        language: "en",
        sourceUrl: "https://asuracomic.net/series/asura-god-father-99",
    };
    const asuraMatch = (0, alternative_normalize_1.buildAlternativeSourceMatch)("asurascans", "Asura Scans", asuraItem, {
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
    }, "en", "1", 1);
    strict_1.default.equal(asuraMatch.sourceId, "asurascans");
    strict_1.default.equal(asuraMatch.externalId, "asura-god-father-99");
    strict_1.default.equal(asuraMatch.matchedChapter?.id, "asura-god-father-99/chapter/1");
    strict_1.default.equal(asuraMatch.matchedChapter?.sourceId, "asurascans");
    strict_1.default.equal(asuraMatch.matchedChapter?.mangaId, "asura-god-father-99");
    strict_1.default.equal(asuraMatch.matchedChapter?.readerUrl, "/sources/asurascans/asura-god-father-99/read/asura-god-father-99%2Fchapter%2F1?lang=en");
});
//# sourceMappingURL=comick.normalize.test.js.map