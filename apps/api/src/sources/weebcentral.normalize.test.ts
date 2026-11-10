import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeChapters,
  normalizeDetails,
  normalizePages,
  normalizeSearch,
  parseWeebCentralChapterLabel,
} from "./weebcentral.normalize";

const SERIES_ID = "01J76XY7E5E1C5Y9J0M2FCVQ8H";
const CHAPTER_ID = "01J76XYY77SY7EJ5AJ2S52JS2C";

test("normalizes WeebCentral quick search results and cover URLs", () => {
  const html = `<section id="quick-search-result"><a href="https://weebcentral.com/series/${SERIES_ID}/Fairy-Tail"><picture><source srcset="https://temp.compsci88.com/cover/small/${SERIES_ID}.webp"><img src="https://temp.compsci88.com/cover/fallback/${SERIES_ID}.jpg"></picture><span>Fairy Tail</span></a><a href="/browse">Browse</a></section>`;
  const result = normalizeSearch(html, { q: "Fairy Tail", page: 1, limit: 20 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].externalId, SERIES_ID);
  assert.equal(result.items[0].title, "Fairy Tail");
  assert.equal(result.items[0].coverUrl, `https://temp.compsci88.com/cover/small/${SERIES_ID}.webp`);
  assert.equal(result.hasMore, false);
});

test("normalizes the advanced catalogue listing, content types, and page-size metadata", () => {
  const html = `<!doctype html><html><body>
    <ul>
      <li><a href="/series/${SERIES_ID}/Fairy-Tail"><img alt="Fairy Tail" src="https://temp.compsci88.com/cover/${SERIES_ID}.webp"></a><strong>Type</strong><span>Manga</span></li>
      <li><a href="/series/01J76XYEVQ0ZFHSDZBTNA55Y1F/Bleach-Color"><img alt="Bleach Color" src="https://temp.compsci88.com/cover/bleach.webp"></a><strong>Type</strong><span>Manhwa</span></li>
      <li><a href="/series/01J76XYHVQ0ZFHSDZBTNA55Y1F/Chinese-Title"><img alt="Chinese Title" src="https://temp.compsci88.com/cover/chinese.webp"></a><strong>Type</strong><span>Manhua</span></li>
    </ul>
  </body></html>`;
  const all = normalizeSearch(html, { q: "", page: 1, limit: 20 });
  assert.equal(all.items.length, 3);
  assert.deepEqual(all.items.map((item) => item.contentType), ["manga", "manhwa", "manhua"]);
  assert.equal(all.items[0].title, "Fairy Tail");
  assert.equal(all.items[0].coverUrl, `https://temp.compsci88.com/cover/${SERIES_ID}.webp`);
  assert.equal(all.hasMore, false);
  assert.equal(all.totalExact, false);

  const manhwa = normalizeSearch(html, { q: "", type: "manhwa", page: 1, limit: 20 });
  assert.equal(manhwa.items.length, 1);
  assert.equal(manhwa.items[0].title, "Bleach Color");
});

test("normalizes title metadata and paginates all 548 source chapters", () => {
  const detailHtml = `<meta property="og:title" content="Fairy Tail | Weeb Central"><meta property="og:description" content="A long story."><meta property="og:url" content="https://weebcentral.com/series/${SERIES_ID}/Fairy-Tail"><meta property="og:image" content="https://temp.compsci88.com/cover/fallback/${SERIES_ID}.jpg"><p><strong>Type:</strong> Manhwa</p>`;
  const details = normalizeDetails(detailHtml, SERIES_ID);
  assert.equal(details.title, "Fairy Tail");
  assert.equal(details.contentType, "manhwa");
  assert.deepEqual(details.availableLanguages, ["en"]);
  assert.equal(details.sourceUrl, `https://weebcentral.com/series/${SERIES_ID}/Fairy-Tail`);

  const fullList = Array.from({ length: 548 }, (_, index) => {
    const number = 548 - index;
    const id = String(number).padStart(26, "0");
    return `<a href="/chapters/${id}">Chapter ${number}</a>`;
  }).join("");
  const first = normalizeChapters(fullList, SERIES_ID, 1, 500);
  const second = normalizeChapters(fullList, SERIES_ID, 2, 500);
  assert.equal(first.items.length, 500);
  assert.equal(first.items[0].numberLabel, "1");
  assert.equal(first.items.at(-1)?.numberLabel, "500");
  assert.equal(first.total, 548);
  assert.equal(first.hasMore, true);
  assert.equal(second.items.length, 48);
  assert.equal(second.items[0].numberLabel, "501");
  assert.equal(second.items.at(-1)?.numberLabel, "548");
  assert.equal(second.hasMore, false);
});

test("normalizes all ordered page images from the WeebCentral reader fragment", () => {
  const images = Array.from({ length: 47 }, (_, index) => {
    const number = index + 1;
    return `<img\n alt="Page ${number}"\n src="https://official.lowee.us/manga/Fairy-Tail/${String(number).padStart(3, "0")}.png"\n />`;
  })
    .reverse()
    .join("");
  const html = `<meta property="og:title" content="Chapter 545 | Fairy Tail | Weeb Central"><a href="/series/${SERIES_ID}/Fairy-Tail">Fairy Tail</a>${images}<img alt="Advertisement" src="/static/ad.png">`;
  const result = normalizePages(html, CHAPTER_ID);
  assert.equal(result.pages.length, 47);
  assert.deepEqual(
    result.pages.map((page) => page.pageNumber),
    Array.from({ length: 47 }, (_, index) => index + 1),
  );
  assert.equal(result.mangaId, SERIES_ID);
  assert.equal(result.chapterNumber, "545");
  assert.equal(result.sourceUrl, `https://weebcentral.com/chapters/${CHAPTER_ID}`);
});

test("parses current WeebCentral article cards with data-tip content type and cover alt text", () => {
  const html = `<article data-tip="Manhwa"><a href="/series/${SERIES_ID}/Fairy-Tail"><img alt="Fairy Tail cover" src="https://temp.compsci88.com/fairy.webp"></a></article>`;
  const result = normalizeSearch(html, { q: "", page: 1, limit: 20 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "Fairy Tail");
  assert.equal(result.items[0].contentType, "manhwa");
  assert.equal(result.items[0].coverUrl, "https://temp.compsci88.com/fairy.webp");
});

test("extracts chapter and episode numbers across all required WeebCentral formats and keeps Special Extra as special", () => {
  const cases: Array<{ label: string; expectedNumber: number | null; expectedLabel: string | null }> = [
    { label: "Chapter 1", expectedNumber: 1, expectedLabel: "1" },
    { label: "Chapter 12", expectedNumber: 12, expectedLabel: "12" },
    { label: "Chapter 12.5", expectedNumber: 12.5, expectedLabel: "12.5" },
    { label: "Chapter 001", expectedNumber: 1, expectedLabel: "1" },
    { label: "Episode 1", expectedNumber: 1, expectedLabel: "1" },
    { label: "Episode 12", expectedNumber: 12, expectedLabel: "12" },
    { label: "Episode 12.5", expectedNumber: 12.5, expectedLabel: "12.5" },
    { label: "Episode 001", expectedNumber: 1, expectedLabel: "1" },
    { label: "Ep. 12", expectedNumber: 12, expectedLabel: "12" },
    { label: "Ch. 12", expectedNumber: 12, expectedLabel: "12" },
    { label: "12", expectedNumber: 12, expectedLabel: "12" },
    { label: "12.5", expectedNumber: 12.5, expectedLabel: "12.5" },
    { label: "Special Extra", expectedNumber: null, expectedLabel: null },
  ];

  for (const [idx, c] of cases.entries()) {
    const parsed = parseWeebCentralChapterLabel(c.label);
    assert.equal(parsed.number, c.expectedNumber, `Failed number extraction for '${c.label}'`);
    assert.equal(parsed.numberLabel, c.expectedLabel, `Failed numberLabel extraction for '${c.label}'`);

    const id = `01J76XYY77SY7EJ5AJ2S52J${String(idx + 1).padStart(3, "0")}`;
    const html = `<a href="/chapters/${id}"><span>${c.label}</span><time datetime="2025-05-10T12:00:00Z">May 10, 2025</time></a>`;
    const normalized = normalizeChapters(html, SERIES_ID, 1, 50);
    assert.equal(normalized.items.length, 1);
    assert.equal(normalized.items[0].number, c.expectedNumber, `HTML normalizeChapters failed for '${c.label}'`);
    assert.equal(normalized.items[0].numberLabel, c.expectedLabel, `HTML numberLabel failed for '${c.label}'`);
  }
});

test("does not confuse numbers inside special titles or dates with chapter numbers and preserves sorting and duplicate detection", () => {
  const html = [
    `<a href="/chapters/01J76XYY77SY7EJ5AJ2S52JS01"><span>Special Extra: Room 302</span><time datetime="2025-05-10">May 10, 2025</time></a>`,
    `<a href="/chapters/01J76XYY77SY7EJ5AJ2S52JS02"><span>Episode 15.5</span><time datetime="2025-05-09">May 9, 2025</time></a>`,
    `<a href="/chapters/01J76XYY77SY7EJ5AJ2S52JS03"><span>Episode 15</span><time datetime="2025-05-08">May 8, 2025</time></a>`,
    `<a href="/chapters/01J76XYY77SY7EJ5AJ2S52JS04"><span>Ch. 15</span><time datetime="2025-05-08">May 8, 2025</time></a>`,
    `<a href="/chapters/01J76XYY77SY7EJ5AJ2S52JS05"><span>Episode 001</span><time datetime="2025-05-01">May 1, 2025</time></a>`,
  ].join("");

  const res = normalizeChapters(html, SERIES_ID, 1, 50);
  assert.equal(res.items.length, 5);
  assert.deepEqual(
    res.items.map((i) => i.number),
    [1, 15, 15, 15.5, null],
  );
  assert.equal(res.items[1].duplicateNumber, true);
  assert.equal(res.items[2].duplicateNumber, true);
  assert.equal(res.items[4].number, null);
  assert.equal(res.items[4].numberLabel, null);
  assert.equal(res.items[4].title, "Special Extra: Room 302");
});

test("PART 1 & PART 3: extracts all required WeebCentral formats (Episode 1, 10, 10.5, 100, Ep. 10, Chapter 10, 10.5, Ch. 10, 10, 10.5, 001), preserves Prologue/Side Story/Special Extra, and extracts release dates", () => {
  const requiredCases: Array<{
    input: string;
    expectedNumber: number | null;
    expectedLabel: string | null;
    expectedOriginal: string | null;
  }> = [
    { input: "Episode 1", expectedNumber: 1, expectedLabel: "1", expectedOriginal: "Episode 1" },
    { input: "Episode 10", expectedNumber: 10, expectedLabel: "10", expectedOriginal: "Episode 10" },
    { input: "Episode 10.5", expectedNumber: 10.5, expectedLabel: "10.5", expectedOriginal: "Episode 10.5" },
    { input: "Episode 100", expectedNumber: 100, expectedLabel: "100", expectedOriginal: "Episode 100" },
    { input: "Ep. 10", expectedNumber: 10, expectedLabel: "10", expectedOriginal: "Ep. 10" },
    { input: "Chapter 10", expectedNumber: 10, expectedLabel: "10", expectedOriginal: "Chapter 10" },
    { input: "Chapter 10.5", expectedNumber: 10.5, expectedLabel: "10.5", expectedOriginal: "Chapter 10.5" },
    { input: "Ch. 10", expectedNumber: 10, expectedLabel: "10", expectedOriginal: "Ch. 10" },
    { input: "10", expectedNumber: 10, expectedLabel: "10", expectedOriginal: "10" },
    { input: "10.5", expectedNumber: 10.5, expectedLabel: "10.5", expectedOriginal: "10.5" },
    { input: "001", expectedNumber: 1, expectedLabel: "1", expectedOriginal: "001" },
    { input: "Prologue", expectedNumber: null, expectedLabel: null, expectedOriginal: "Prologue" },
    { input: "Special Extra", expectedNumber: null, expectedLabel: null, expectedOriginal: "Special Extra" },
    { input: "Side Story", expectedNumber: null, expectedLabel: null, expectedOriginal: "Side Story" },
  ];

  for (const c of requiredCases) {
    const res = parseWeebCentralChapterLabel(c.input);
    assert.equal(res.number, c.expectedNumber, `Number mismatch for ${c.input}`);
    assert.equal(res.numberLabel, c.expectedLabel, `Label mismatch for ${c.input}`);
    assert.equal(res.originalLabel, c.expectedOriginal, `Original label mismatch for ${c.input}`);
  }

  // Multi-span HTML with Episode 10 + subtitle + sibling <time datetime>
  const multiSpanHtml = `
    <div class="row">
      <a href="https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52JS99">
        <span class="grow flex items-center gap-2">
          <span>Episode 10</span>
          <span>The Shadow Gate</span>
        </span>
      </a>
      <time datetime="2026-11-10T15:30:00Z">10 November 2026</time>
    </div>
  `;
  const chRes = normalizeChapters(multiSpanHtml, SERIES_ID, 1, 10);
  assert.equal(chRes.items.length, 1);
  assert.equal(chRes.items[0].number, 10);
  assert.equal(chRes.items[0].numberLabel, "10");
  assert.equal(chRes.items[0].originalLabel, "Episode 10");
  assert.equal(chRes.items[0].title, "The Shadow Gate");
  assert.equal(chRes.items[0].publishedAt, "2026-11-10T15:30:00.000Z");
});
