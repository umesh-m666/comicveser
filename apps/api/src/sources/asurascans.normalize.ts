import type { ChapterItem, ChapterPages, ChaptersResponse, ContentType, MangaDetails, MangaSummary, SearchQuery, SearchResponse } from "./provider.interface";
import { SourceError } from "./provider.interface";
import { attributes, elements, htmlText } from "./html";
import { extractReleaseDateFromMarkup, parseExplicitReleaseDate } from "./weebcentral.normalize";

const SITE = "https://asurascans.com";
const CDN_HOST = "cdn.asurascans.com";
type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj => value && typeof value === "object" ? value as Obj : {};
const str = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function contentType(value: unknown): ContentType {
  const type = typeof value === "string" ? value.toLowerCase() : "";
  return ["manga", "manhwa", "manhua", "webtoon", "novel"].includes(type) ? type as ContentType : "unknown";
}

function externalId(row: Obj): string | null {
  const publicUrl = str(row.public_url);
  if (publicUrl) {
    try {
      const path = new URL(publicUrl, SITE).pathname.split("/").filter(Boolean);
      if (path[0] === "comics" && path[1] && /^[a-z0-9-]+$/i.test(path[1])) return path[1];
    } catch { /* use the source's slug below */ }
  }
  return str(row.slug);
}

export function normalizeSummary(raw: unknown): MangaSummary | null {
  const row = obj(raw);
  const id = externalId(row);
  const title = str(row.title);
  if (!id || !title) return null;
  const publicUrl = str(row.public_url) ?? `/comics/${id}`;
  let sourceUrl: string;
  try {
    const url = new URL(publicUrl, SITE);
    if (url.protocol !== "https:" || url.hostname !== "asurascans.com") return null;
    sourceUrl = url.toString();
  } catch { return null; }
  const description = str(row.description);
  return {
    id, externalId: id, sourceId: "asurascans", title,
    alternativeTitles: list(row.alt_titles).filter((value): value is string => typeof value === "string" && !!value.trim()),
    coverUrl: str(row.cover) ?? str(row.cover_url), description: description ? htmlText(description) : null,
    status: str(row.status), genres: list(row.genres).map((genre) => str(obj(genre).name)).filter((name): name is string => !!name),
    contentType: contentType(row.type), language: "en", sourceUrl,
  };
}

export function normalizeSearch(raw: unknown, query: SearchQuery): SearchResponse {
  const body = obj(raw);
  const meta = obj(body.meta);
  if (!Array.isArray(body.data) || typeof meta.total !== "number") {
    throw new SourceError("BAD_RESPONSE", "Asura Scans sent a response we could not read.");
  }
  const items = list(body.data).map(normalizeSummary).filter((item): item is MangaSummary => !!item);
  const total = meta.total;
  const limit = Math.min(Math.max(query.limit, 1), 24);
  return {
    items, total, page: query.page, limit,
    hasMore: (query.page - 1) * limit + items.length < total,
  };
}

export function normalizeDetails(raw: unknown): MangaDetails {
  const summary = normalizeSummary(raw);
  if (!summary) throw new SourceError("BAD_RESPONSE", "Asura Scans returned a title we could not read.");
  const row = obj(raw);
  const authors = [str(row.author)].filter((value): value is string => !!value);
  const artists = [str(row.artist)].filter((value): value is string => !!value);
  return { ...summary, authors, artists, year: null, availableLanguages: ["en"] };
}

function chapterNumber(value: string): number | null {
  const match = value.match(/^\d+(?:\.\d+)?$/);
  if (!match) return null;
  const number = Number.parseFloat(match[0]);
  return Number.isFinite(number) ? number : null;
}

/**
 * Extracts structured chapter release dates from embedded Next.js / JSON script blocks in AsuraScans HTML if present.
 */
function extractStructuredChapterDates(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const normalizedHtml = html.replace(/\\"/g, '"');
  const pattern = /"(?:name|slug|chapter_slug|number)"\s*:\s*"?([a-z0-9.-]+)"?[^{}]{0,260}?"(?:published_at|created_at|released_at|publishedAt)"\s*:\s*"([^"]+)"/gi;
  for (const m of normalizedHtml.matchAll(pattern)) {
    const chId = m[1]?.trim();
    const parsedDate = parseExplicitReleaseDate(m[2]);
    if (chId && parsedDate && !map.has(chId)) {
      map.set(chId, parsedDate);
    }
  }
  return map;
}

export function parseAsuraScansChapterMarkup(
  innerHtml: string,
  chapterId: string,
  surroundingHtml = "",
  structuredDates?: Map<string, string>,
): {
  number: number | null;
  numberLabel: string | null;
  originalLabel: string | null;
  title: string | null;
  publishedAt: string | null;
} {
  const publishedAt =
    extractReleaseDateFromMarkup(innerHtml) ??
    (surroundingHtml ? extractReleaseDateFromMarkup(surroundingHtml) : null) ??
    structuredDates?.get(chapterId) ??
    null;

  const withoutTime = innerHtml
    .replace(/<time\b[^>]*>[\s\S]*?<\/time>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");

  let text = htmlText(withoutTime).trim();
  // Remove trailing date strings so they never become part of the title or chapter number
  text = text
    .replace(
      /\s*\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)?\b\s*$/i,
      "",
    )
    .replace(
      /\s*\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?,?\s+\d{4}\b\s*$/i,
      "",
    )
    .replace(/\s*\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?\b\s*$/i, "")
    .replace(/\s*\b\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b\s*$/i, "")
    .trim();

  const prefixed = text.match(/^((?:chapter|chap\.?|ch\.?|episode|ep\.?)\s*#?\s*(\d+(?:\.\d+)?))(?:\s*(?:[-–—:·]|\s+)\s*(.+))?$/i);
  if (prefixed) {
    const rawOriginal = prefixed[1].trim();
    const num = Number.parseFloat(prefixed[2]);
    if (Number.isFinite(num)) {
      const normalizedStr = String(num);
      const subtitle = prefixed[3]?.trim() || null;
      return {
        number: num,
        numberLabel: normalizedStr,
        originalLabel: rawOriginal,
        title: subtitle,
        publishedAt,
      };
    }
  }

  const idNumeric = chapterId.match(/^\d+(?:\.\d+)?$/)?.[0] ?? null;
  if (idNumeric) {
    const num = Number.parseFloat(idNumeric);
    const normalizedStr = String(num);
    const cleanedTitle = text && !new RegExp(`^(?:chapter|ep\\.?|episode)?\\s*0*${num}$`, "i").test(text) ? text : null;
    return {
      number: num,
      numberLabel: normalizedStr,
      originalLabel: text || `Chapter ${normalizedStr}`,
      title: cleanedTitle,
      publishedAt,
    };
  }

  return {
    number: null,
    numberLabel: null,
    originalLabel: text || null,
    title: text || null,
    publishedAt,
  };
}

function getChapterRows(html: string, mangaId: string): ChapterItem[] {
  const expectedPrefix = `/comics/${mangaId}/chapter/`;
  const rows = new Map<string, ChapterItem>();
  const structuredDates = extractStructuredChapterDates(html);
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  const matches = [...html.matchAll(anchorRegex)];

  for (let i = 0; i < matches.length; i++) {
    const fullMatch = matches[i];
    const openAttrs = attributes(`<a${fullMatch[1]}>`);
    const innerHtml = fullMatch[2];
    const href = openAttrs.href;
    if (!href) continue;
    let url: URL;
    try { url = new URL(href, SITE); } catch { continue; }
    if (url.protocol !== "https:" || url.hostname !== "asurascans.com" || !url.pathname.startsWith(expectedPrefix)) continue;
    const id = url.pathname.slice(expectedPrefix.length).split("/")[0];
    if (!id || !/^[a-z0-9.-]+$/i.test(id)) continue;

    const endIdx = (fullMatch.index ?? 0) + fullMatch[0].length;
    const nextStartIdx = i + 1 < matches.length ? (matches[i + 1].index ?? endIdx + 350) : endIdx + 350;
    const siblingSnippet = html.slice(endIdx, Math.min(nextStartIdx, endIdx + 350));

    const parsed = parseAsuraScansChapterMarkup(innerHtml, id, siblingSnippet, structuredDates);
    rows.set(id, {
      id,
      sourceId: "asurascans",
      mangaId,
      number: parsed.number,
      numberLabel: parsed.numberLabel,
      originalLabel: parsed.originalLabel,
      title: parsed.title,
      volume: null,
      language: "en",
      publishedAt: parsed.publishedAt,
      groups: [],
      pageCount: null,
      sourceUrl: url.toString(),
      duplicateNumber: false,
    });
  }
  const items = [...rows.values()].sort((a, b) =>
    (a.number === null ? 1 : 0) - (b.number === null ? 1 : 0)
    || (a.number ?? 0) - (b.number ?? 0)
    || (a.id.localeCompare(b.id)));
  markDuplicateNumbers(items);
  return items;
}

function markDuplicateNumbers(items: ChapterItem[]): void {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.numberLabel) counts.set(item.numberLabel, (counts.get(item.numberLabel) ?? 0) + 1);
  }
  for (const item of items) item.duplicateNumber = !!item.numberLabel && (counts.get(item.numberLabel) ?? 0) > 1;
}

export function normalizeChapters(html: string, mangaId: string, page: number, limit: number): ChaptersResponse {
  const all = getChapterRows(html, mangaId);
  const items = all.slice((page - 1) * limit, page * limit);
  return { items, total: all.length, page, limit, hasMore: page * limit < all.length };
}

export function normalizePages(html: string, mangaId: string, chapterId: string): ChapterPages {
  const pages = voidImageTags(html).flatMap((attrs) => {
    const src = attrs.src;
    if (!src) return [];
    try {
      const url = new URL(src, SITE);
      if (url.protocol !== "https:" || url.hostname !== CDN_HOST || !url.pathname.startsWith("/asura-images/chapters/")) return [];
      return [{
        pageNumber: Number.parseInt(attrs.alt?.match(/page\s+(\d+)/i)?.[1] ?? "", 10) || 0,
        imageUrl: url.toString(),
        width: positiveInt(attrs.width),
        height: positiveInt(attrs.height),
      }];
    } catch { return []; }
  }).filter((page) => page.pageNumber > 0).sort((a, b) => a.pageNumber - b.pageNumber);
  if (!pages.length) throw new SourceError("BAD_RESPONSE", "Asura Scans did not return readable chapter pages.");
  const sourceUrl = `${SITE}/comics/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(chapterId)}`;
  const title = elements(html, "h1").map((element) => htmlText(element.innerHtml)).find(Boolean) ?? null;
  return {
    sourceId: "asurascans", mangaId, chapterId, chapterTitle: title, chapterNumber: chapterNumber(chapterId)?.toString() ?? null,
    language: "en", pages, groups: [], sourceUrl,
  };
}

function voidImageTags(html: string): ReturnType<typeof attributes>[] {
  const tags: ReturnType<typeof attributes>[] = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) tags.push(attributes(match[0]));
  return tags;
}

function positiveInt(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
