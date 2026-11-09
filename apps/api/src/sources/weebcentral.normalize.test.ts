import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeChapters, normalizeDetails, normalizePages, normalizeSearch } from "./weebcentral.normalize";

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
  }).reverse().join("");
  const html = `<meta property="og:title" content="Chapter 545 | Fairy Tail | Weeb Central"><a href="/series/${SERIES_ID}/Fairy-Tail">Fairy Tail</a>${images}<img alt="Advertisement" src="/static/ad.png">`;
  const result = normalizePages(html, CHAPTER_ID);
  assert.equal(result.pages.length, 47);
  assert.deepEqual(result.pages.map((page) => page.pageNumber), Array.from({ length: 47 }, (_, index) => index + 1));
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
