import { SourceError } from "./provider.interface";
import type { ChapterItem, ChapterPages, ChaptersResponse, MangaDetails, MangaSummary, SearchQuery, SearchResponse } from "./provider.interface";
import { elements, htmlText, metaContent, voidElements } from "./html";

const SITE = "https://weebcentral.com";
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

function safeUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function sourceIdFromUrl(value: string): string | null {
  const url = safeUrl(value, SITE);
  if (!url || new URL(url).hostname !== new URL(SITE).hostname) return null;
  const match = new URL(url).pathname.match(/^\/series\/([0-9A-HJKMNP-TV-Z]{26})(?:\/|$)/i);
  return match && ULID.test(match[1]) ? match[1].toUpperCase() : null;
}

function coverFrom(html: string): string | null {
  const source = voidElements(html, "source").find((item) => item.srcset);
  const image = voidElements(html, "img").find((item) => item.src);
  const value = source?.srcset?.split(",")[0]?.trim().split(/\s+/)[0] ?? image?.src ?? image?.["data-src"] ?? image?.["data-original"] ?? null;
  return safeUrl(value, SITE);
}

function normalizedContentType(value: string): "manga" | "manhwa" | "manhua" | "unknown" {
  const text = value.toLowerCase();
  if (/\bmanhwa\b/.test(text)) return "manhwa";
  if (/\bmanhua\b/.test(text)) return "manhua";
  if (/\bmanga\b/.test(text)) return "manga";
  return "unknown";
}

function contentTypeFrom(markup: string): "manga" | "manhwa" | "manhua" | "unknown" {
  // WeebCentral's catalogue cards expose the type as a labelled value or
  // inside an element whose class contains "type". Keep this parsing
  // tolerant of small markup changes on the upstream site.
  const typeLabel = markup.match(/<strong[^>]*>\s*type\s*<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1];
  if (typeLabel) return normalizedContentType(htmlText(typeLabel));
  const typedElement = [ ...elements(markup, "span"), ...elements(markup, "div"), ...elements(markup, "p") ]
    .find((element) => /type/i.test(element.attrs.class ?? ""));
  if (typedElement) {
    const parsed = normalizedContentType(htmlText(typedElement.innerHtml));
    if (parsed !== "unknown") return parsed;
  }
  const plain = htmlText(markup);
  const labelled = plain.match(/\btype\s*:?\s*(manga|manhwa|manhua)\b/i)?.[1];
  return normalizedContentType(labelled ?? "");
}

function summaryFromLink(href: string, title: string, html: string, cardType?: string): MangaSummary | null {
  const id = sourceIdFromUrl(href);
  const sourceUrl = safeUrl(href, SITE);
  if (!id || !sourceUrl) return null;
  const image = voidElements(html, "img")[0];
  const rawTitle = htmlText(title) || htmlText(image?.alt ?? "");
  const resolvedTitle = rawTitle.replace(/^Official\s+/i, "").trim() || rawTitle;
  if (!resolvedTitle) return null;
  const type = normalizedContentType(cardType ?? "") !== "unknown"
    ? normalizedContentType(cardType ?? "")
    : contentTypeFrom(html);
  return {
    id, externalId: id, sourceId: "weebcentral", title: resolvedTitle, alternativeTitles: [],
    coverUrl: coverFrom(html), description: null, status: null, genres: [],
    contentType: type, language: "en", sourceUrl,
  };
}

function seriesAnchor(markup: string) {
  return elements(markup, "a").find((anchor) => !!anchor.attrs.href && !!sourceIdFromUrl(anchor.attrs.href)) ?? null;
}

export function normalizeSearch(html: string, query: SearchQuery): SearchResponse {
  const isQuickSearch = /\bid\s*=\s*["']quick-search-result["']/i.test(html);
  const isCatalogueFragment = /<(?:article|li)\b/i.test(html) && /\/series\/[0-9A-HJKMNP-TV-Z]{26}/i.test(html);
  if (!isQuickSearch && !isCatalogueFragment && !/<(?:!doctype\s+html|html)\b/i.test(html)) {
    throw new SourceError("BAD_RESPONSE", "WeebCentral sent a response we could not read.");
  }

  const found: MangaSummary[] = [];
  const seen = new Set<string>();
  const add = (href: string, title: string, markup: string, cardType?: string) => {
    const item = summaryFromLink(href, title, markup, cardType);
    if (!item || seen.has(item.externalId)) return;
    seen.add(item.externalId);
    found.push(item);
  };

  if (isQuickSearch) {
    for (const anchor of elements(html, "a")) {
      if (anchor.attrs.href) add(anchor.attrs.href, htmlText(anchor.innerHtml), anchor.innerHtml);
    }
  } else {
    // The advanced search page renders each result as a list item or article.
    // Extract the series link from its containing card so type and cover data
    // outside the anchor are still available to the normalizer.
    const cards = [...elements(html, "li"), ...elements(html, "article")];
    for (const card of cards) {
      const anchor = seriesAnchor(card.innerHtml);
      if (!anchor?.attrs.href) continue;
      const image = voidElements(card.innerHtml, "img")[0];
      const tip = card.attrs["data-tip"] ?? card.attrs["data-tooltip"]
        ?? card.innerHtml.match(/data-tip\s*=\\s*["']([^"']+)["']/i)?.[1]
        ?? card.innerHtml.match(/data-tooltip\s*=\\s*["']([^"']+)["']/i)?.[1]
        ?? "";
      const imageTitle = (image?.alt ?? "").replace(/\s*cover\s*$/i, "").trim();
      add(anchor.attrs.href, imageTitle || htmlText(anchor.innerHtml), card.innerHtml, tip);
    }
    // A fallback for upstream markup that no longer uses li/article cards.
    if (!found.length) {
      for (const anchor of elements(html, "a")) {
        if (anchor.attrs.href) add(anchor.attrs.href, htmlText(anchor.innerHtml), anchor.innerHtml);
      }
    }
  }

  if (!isQuickSearch && !found.length && /captcha|cloudflare|just a moment|verify you are human|access denied/i.test(html)) {
    throw new SourceError("SOURCE_UNAVAILABLE", "WeebCentral is showing an access-check page instead of its catalogue. Try again later.");
  }

  const page = Math.max(query.page, 1);
  const limit = Math.min(Math.max(query.limit, 1), 24);
  const typed = query.type ? found.filter((item) => item.contentType === query.type) : found;
  const items = typed.slice(0, limit);

  if (isQuickSearch) return { items, total: typed.length, page, limit, hasMore: false };

  // WeebCentral's HTML catalogue does not provide a stable total count.
  // Treat a full page as a possible next page and expose a lower-bound count.
  const hasMore = found.length >= limit;
  const offset = (page - 1) * limit;
  return {
    items,
    total: offset + items.length + (hasMore ? 1 : 0),
    totalExact: false,
    page,
    limit,
    hasMore,
  };
}

function detailsTitle(html: string): string | null {
  const ogTitle = metaContent(html, "property", "og:title");
  if (ogTitle) return htmlText(ogTitle.replace(/\s*\|\s*Weeb Central\s*$/i, ""));
  return elements(html, "h1").map((element) => htmlText(element.innerHtml)).find(Boolean) ?? null;
}

export function normalizeDetails(html: string, externalId: string): MangaDetails {
  const title = detailsTitle(html);
  if (!title) throw new SourceError("BAD_RESPONSE", "WeebCentral returned a title we could not read.");
  const description = metaContent(html, "property", "og:description");
  const sourceUrl = safeUrl(metaContent(html, "property", "og:url"), SITE)
    ?? `${SITE}/series/${encodeURIComponent(externalId)}`;
  const coverUrl = safeUrl(metaContent(html, "property", "og:image"), SITE);
  const detectedType = contentTypeFrom(html);
  const summary: MangaSummary = {
    id: externalId, externalId, sourceId: "weebcentral", title, alternativeTitles: [],
    coverUrl, description: description ? htmlText(description) : null, status: null, genres: [],
    // Retain the old Manga fallback only when WeebCentral omits its type label.
    contentType: detectedType === "unknown" ? "manga" : detectedType,
    language: "en", sourceUrl,
  };
  return { ...summary, authors: [], artists: [], year: null, availableLanguages: ["en"] };
}

function chapterNumber(value: string): number | null {
  const match = value.match(/(?:chapter\s*)?(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const number = Number.parseFloat(match[1]);
  return Number.isFinite(number) ? number : null;
}

function duplicateNumbers(items: ChapterItem[]): void {
  const counts = new Map<string, number>();
  for (const item of items) if (item.numberLabel) counts.set(item.numberLabel, (counts.get(item.numberLabel) ?? 0) + 1);
  for (const item of items) item.duplicateNumber = !!item.numberLabel && (counts.get(item.numberLabel) ?? 0) > 1;
}

export function normalizeChapters(html: string, mangaId: string, page: number, limit: number): ChaptersResponse {
  const all = new Map<string, ChapterItem>();
  for (const anchor of elements(html, "a")) {
    const href = safeUrl(anchor.attrs.href ?? null, SITE);
    if (!href || new URL(href).hostname !== new URL(SITE).hostname) continue;
    const url = new URL(href);
    const match = url.pathname.match(/^\/chapters\/([0-9A-HJKMNP-TV-Z]{26})\/?$/i);
    if (!match) continue;
    const id = match[1].toUpperCase();
    const label = htmlText(anchor.innerHtml);
    const numberLabel = label.match(/chapter\s+([\d.]+)/i)?.[1] ?? null;
    all.set(id, {
      id, sourceId: "weebcentral", mangaId, number: numberLabel ? chapterNumber(numberLabel) : null,
      numberLabel, title: null, volume: null, language: "en", publishedAt: null, groups: [],
      pageCount: null, sourceUrl: href, duplicateNumber: false,
    });
  }
  const ordered = [...all.values()].sort((a, b) =>
    (a.number === null ? 1 : 0) - (b.number === null ? 1 : 0)
    || (a.number ?? 0) - (b.number ?? 0)
    || a.id.localeCompare(b.id));
  duplicateNumbers(ordered);
  const items = ordered.slice((page - 1) * limit, page * limit);
  return { items, total: ordered.length, page, limit, hasMore: page * limit < ordered.length };
}

export function normalizePages(html: string, chapterId: string, requestedMangaId?: string): ChapterPages {
  const pages = voidElements(html, "img").flatMap((image) => {
    const number = Number.parseInt(image.alt?.match(/page\s+(\d+)/i)?.[1] ?? "", 10);
    const imageUrl = safeUrl(image.src ?? null, SITE);
    return number > 0 && imageUrl ? [{ pageNumber: number, imageUrl, width: null, height: null }] : [];
  }).sort((a, b) => a.pageNumber - b.pageNumber);
  if (!pages.length) throw new SourceError("BAD_RESPONSE", "WeebCentral did not return readable chapter pages.");
  const title = htmlText(metaContent(html, "property", "og:title") ?? "");
  const seriesLink = elements(html, "a").map((anchor) => anchor.attrs.href ?? "")
    .find((href) => !!sourceIdFromUrl(href));
  const mangaId = requestedMangaId?.toUpperCase() ?? (seriesLink ? sourceIdFromUrl(seriesLink) : null);
  const match = title.match(/chapter\s+([\d.]+)/i);
  return {
    sourceId: "weebcentral", mangaId, chapterId,
    chapterTitle: title.replace(/\s*\|\s*Weeb Central\s*$/i, "") || null,
    chapterNumber: match?.[1] ?? null, language: "en", pages, groups: [],
    sourceUrl: `${SITE}/chapters/${encodeURIComponent(chapterId)}`,
  };
}
