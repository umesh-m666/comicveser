import { SourceError } from "./provider.interface";
import type {
  ChapterItem,
  ChapterPages,
  ChaptersResponse,
  MangaDetails,
  MangaSummary,
  SearchQuery,
  SearchResponse,
} from "./provider.interface";
import { elements, htmlText, metaContent, voidElements } from "./html";

const SITE = "https://weebcentral.com";
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

function safeUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
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
  const value =
    source?.srcset?.split(",")[0]?.trim().split(/\s+/)[0] ??
    image?.src ??
    image?.["data-src"] ??
    image?.["data-original"] ??
    null;
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
  const typeLabel = markup.match(/<strong[^>]*>\s*type\s*<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1];
  if (typeLabel) return normalizedContentType(htmlText(typeLabel));
  const typedElement = [...elements(markup, "span"), ...elements(markup, "div"), ...elements(markup, "p")].find(
    (element) => /type/i.test(element.attrs.class ?? ""),
  );
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
  const type =
    normalizedContentType(cardType ?? "") !== "unknown"
      ? normalizedContentType(cardType ?? "")
      : contentTypeFrom(html);
  return {
    id,
    externalId: id,
    sourceId: "weebcentral",
    title: resolvedTitle,
    alternativeTitles: [],
    coverUrl: coverFrom(html),
    description: null,
    status: null,
    genres: [],
    contentType: type,
    language: "en",
    sourceUrl,
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
    const cards = [...elements(html, "li"), ...elements(html, "article")];
    for (const card of cards) {
      const anchor = seriesAnchor(card.innerHtml);
      if (!anchor?.attrs.href) continue;
      const image = voidElements(card.innerHtml, "img")[0];
      const tip =
        card.attrs["data-tip"] ??
        card.attrs["data-tooltip"] ??
        card.innerHtml.match(/data-tip\s*=\s*["']([^"']+)["']/i)?.[1] ??
        card.innerHtml.match(/data-tooltip\s*=\s*["']([^"']+)["']/i)?.[1] ??
        "";
      const imageTitle = (image?.alt ?? "").replace(/\s*cover\s*$/i, "").trim();
      add(anchor.attrs.href, imageTitle || htmlText(anchor.innerHtml), card.innerHtml, tip);
    }
    if (!found.length) {
      for (const anchor of elements(html, "a")) {
        if (anchor.attrs.href) add(anchor.attrs.href, htmlText(anchor.innerHtml), anchor.innerHtml);
      }
    }
  }

  if (
    !isQuickSearch &&
    !found.length &&
    /captcha|cloudflare|just a moment|verify you are human|access denied/i.test(html)
  ) {
    throw new SourceError(
      "SOURCE_UNAVAILABLE",
      "WeebCentral is showing an access-check page instead of its catalogue. Try again later.",
    );
  }

  const page = Math.max(query.page, 1);
  const limit = Math.min(Math.max(query.limit, 1), 24);
  const typed = query.type ? found.filter((item) => item.contentType === query.type) : found;
  const items = typed.slice(0, limit);

  if (isQuickSearch) return { items, total: typed.length, page, limit, hasMore: false };

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
  return (
    elements(html, "h1")
      .map((element) => htmlText(element.innerHtml))
      .find(Boolean) ?? null
  );
}

export function normalizeDetails(html: string, externalId: string): MangaDetails {
  const title = detailsTitle(html);
  if (!title) throw new SourceError("BAD_RESPONSE", "WeebCentral returned a title we could not read.");
  const description = metaContent(html, "property", "og:description");
  const sourceUrl =
    safeUrl(metaContent(html, "property", "og:url"), SITE) ??
    `${SITE}/series/${encodeURIComponent(externalId)}`;
  const coverUrl = safeUrl(metaContent(html, "property", "og:image"), SITE) ?? coverFrom(html);
  const detectedType = contentTypeFrom(html);
  const summary: MangaSummary = {
    id: externalId,
    externalId,
    sourceId: "weebcentral",
    title,
    alternativeTitles: [],
    coverUrl,
    description: description ? htmlText(description) : null,
    status: null,
    genres: [],
    contentType: detectedType === "unknown" ? "manga" : detectedType,
    language: "en",
    sourceUrl,
  };
  return { ...summary, authors: [], artists: [], year: null, availableLanguages: ["en"] };
}

export interface ParsedWeebCentralChapterLabel {
  number: number | null;
  numberLabel: string | null;
  originalLabel: string | null;
  title: string | null;
  publishedAt: string | null;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parses an explicit date/timestamp string into a UTC ISO-8601 string without inventing dates.
 * Returns null if the string is not a valid date or is a relative phrase ("3 days ago").
 */
export function parseExplicitReleaseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned || /\bago\b|yesterday|today|just now/i.test(cleaned)) return null;

  // 1. ISO-8601 date or timestamp (e.g. "2025-05-10", "2025-05-10T12:00:00Z", "2026-11-10 14:30:00")
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (isoMatch) {
    const normalizedIso = isoMatch[4]
      ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[4]}:${isoMatch[5]}:${isoMatch[6] ?? "00"}${isoMatch[7] ?? "Z"}`
      : `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`;
    const d = new Date(normalizedIso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // 2. Month Day, Year (e.g. "May 10, 2025", "November 10th 2026", "Nov. 10, 2026")
  const mdyMatch = cleaned.match(
    /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i,
  );
  if (mdyMatch) {
    const monthIdx = MONTH_MAP[mdyMatch[1].toLowerCase()];
    const day = Number.parseInt(mdyMatch[2], 10);
    const year = Number.parseInt(mdyMatch[3], 10);
    if (monthIdx !== undefined && day >= 1 && day <= 31 && year >= 1970 && year <= 2100) {
      let hour = mdyMatch[4] ? Number.parseInt(mdyMatch[4], 10) : 0;
      const minute = mdyMatch[5] ? Number.parseInt(mdyMatch[5], 10) : 0;
      const ampm = mdyMatch[6]?.toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      const d = new Date(Date.UTC(year, monthIdx, day, hour, minute, 0));
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }

  // 3. Day Month Year (e.g. "10 November 2026", "10th Nov 2026")
  const dmyMatch = cleaned.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i,
  );
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1], 10);
    const monthIdx = MONTH_MAP[dmyMatch[2].toLowerCase()];
    const year = Number.parseInt(dmyMatch[3], 10);
    if (monthIdx !== undefined && day >= 1 && day <= 31 && year >= 1970 && year <= 2100) {
      let hour = dmyMatch[4] ? Number.parseInt(dmyMatch[4], 10) : 0;
      const minute = dmyMatch[5] ? Number.parseInt(dmyMatch[5], 10) : 0;
      const ampm = dmyMatch[6]?.toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      const d = new Date(Date.UTC(year, monthIdx, day, hour, minute, 0));
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }

  const fallback = new Date(cleaned);
  if (!Number.isNaN(fallback.getTime()) && fallback.getUTCFullYear() >= 1990 && fallback.getUTCFullYear() <= 2100) {
    return fallback.toISOString();
  }
  return null;
}

export function extractReleaseDateFromMarkup(markup: string): string | null {
  // 1. <time datetime="..."> or data-datetime / data-date / data-released
  const attrPatterns = [
    /<time[^>]*\bdatetime\s*=\s*["']([^"']+)["'][^>]*>/i,
    /\bdata-(?:date)?time\s*=\s*["']([^"']+)["']/i,
    /\bdata-released(?:-at)?\s*=\s*["']([^"']+)["']/i,
  ];
  for (const pat of attrPatterns) {
    const m = markup.match(pat);
    if (m?.[1]) {
      const parsed = parseExplicitReleaseDate(m[1]);
      if (parsed) return parsed;
    }
  }

  // 2. Inner text of <time>...</time>
  for (const timeEl of elements(markup, "time")) {
    const dtAttr = timeEl.attrs.datetime || timeEl.attrs["data-datetime"];
    if (dtAttr) {
      const parsed = parseExplicitReleaseDate(dtAttr);
      if (parsed) return parsed;
    }
    const inner = htmlText(timeEl.innerHtml);
    const parsedInner = parseExplicitReleaseDate(inner);
    if (parsedInner) return parsedInner;
  }

  // 3. Inline date string in markup text
  const plain = htmlText(markup);
  const inlineDateMatch =
    plain.match(/\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/i) ??
    plain.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?,?\s+\d{4})\b/i) ??
    plain.match(/\b(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?)\b/);
  if (inlineDateMatch?.[1]) {
    return parseExplicitReleaseDate(inlineDateMatch[1]);
  }
  return null;
}

/**
 * Extracts normalized chapter or episode numbers from WeebCentral anchor markup or text.
 * Supports:
 *  - Episode 1, Episode 10, Episode 10.5, Episode 100, Episode 001
 *  - Ep. 10, Ep 10, Ep.10
 *  - Chapter 1, Chapter 10, Chapter 10.5, Chapter 001
 *  - Ch. 10, Ch 10, Ch.10, Chap. 10, Chap 10
 *  - 10, 10.5, 001
 *  - Genuine specials: Prologue, Special Extra, Side Story -> number: null, numberLabel: null
 * Avoids extracting unrelated numbers from chapter titles or release dates.
 */
export function parseWeebCentralChapterLabel(
  rawMarkupOrText: string,
  surroundingContextHtml?: string,
): ParsedWeebCentralChapterLabel {
  const publishedAt =
    extractReleaseDateFromMarkup(rawMarkupOrText) ??
    (surroundingContextHtml ? extractReleaseDateFromMarkup(surroundingContextHtml) : null);

  // Strip <time> and <svg> blocks before converting HTML to text so dates never pollute chapter labels
  const withoutTimeAndIcons = rawMarkupOrText
    .replace(/<time\b[^>]*>[\s\S]*?<\/time>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");

  // Check if leaf <span> elements separate the primary label (e.g. "Episode 10") from a subtitle
  const leafSpanTexts: string[] = [];
  for (const m of withoutTimeAndIcons.matchAll(/<span\b[^>]*>([^<]+)<\/span>/gi)) {
    const t = htmlText(m[1]).trim();
    if (t && !/^(?:new|hot|up|last\s*read|read)$/i.test(t) && !parseExplicitReleaseDate(t)) {
      leafSpanTexts.push(t);
    }
  }

  let text = htmlText(withoutTimeAndIcons).trim();

  // Strip trailing inline dates (e.g. "May 10, 2025", "10 November 2026", "2025-05-10", "3 days ago")
  text = text
    .replace(
      /\s+\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b\s*$/i,
      "",
    )
    .replace(
      /\s+\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?,?\s+\d{4}\b\s*$/i,
      "",
    )
    .replace(/\s+\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?\b\s*$/i, "")
    .replace(/\s+\b\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b\s*$/i, "")
    .trim();

  if (!text) {
    return { number: null, numberLabel: null, originalLabel: null, title: null, publishedAt };
  }

  // If multiple leaf spans exist and the first leaf span is an explicit label (e.g. "Episode 10"),
  // join it with ": " so the subtitle in subsequent spans is cleanly separated.
  if (leafSpanTexts.length >= 2) {
    const firstSpan = leafSpanTexts[0];
    if (/^(?:(?:vol(?:ume)?|season|s|part|pt)\.?\s*\d+\s*[-–—:·]?\s*)?(?:chapter|chap\.?|ch\.?|episode|ep\.?|#)?\s*\d+(?:\.\d+)?$/i.test(firstSpan)) {
      const restSubtitle = leafSpanTexts.slice(1).join(" - ").trim();
      text = restSubtitle ? `${firstSpan}: ${restSubtitle}` : firstSpan;
    }
  }

  // 1. Explicit Chapter / Episode / Ch. / Ep. prefix (with optional Vol. / Season / Part prefix)
  const prefixedMatch = text.match(
    /^((?:(?:vol(?:ume)?|season|s|part|pt)\.?\s*\d+\s*[-–—:·]?\s*)?(?:chapter|chap\.?|ch\.?|episode|ep\.?)\s*#?\s*(\d+(?:\.\d+)?))(?:\s*(?:[-–—:·]|\s+)\s*(.+))?$/i,
  );
  if (prefixedMatch) {
    const rawOriginalPrefix = prefixedMatch[1].trim();
    const num = Number.parseFloat(prefixedMatch[2]);
    if (Number.isFinite(num)) {
      const normalizedStr = String(num);
      const rawSubtitle = prefixedMatch[3]?.trim() || null;
      const subtitle = rawSubtitle && !/^(?:new|up|hot)$/i.test(rawSubtitle) ? rawSubtitle : null;
      return {
        number: num,
        numberLabel: normalizedStr,
        originalLabel: rawOriginalPrefix,
        title: subtitle,
        publishedAt,
      };
    }
  }

  // 2. Pure numeric label (e.g. "10", "10.5", "001") or numeric label with ": Subtitle" / "- Subtitle"
  const bareNumericMatch = text.match(/^(#?\s*(\d+(?:\.\d+)?))(?:\s*[-–—:]\s*(.+))?$/);
  if (bareNumericMatch) {
    const rawOriginalNumeric = bareNumericMatch[1].trim();
    const num = Number.parseFloat(bareNumericMatch[2]);
    if (Number.isFinite(num)) {
      const normalizedStr = String(num);
      const subtitle = bareNumericMatch[3]?.trim() || null;
      return {
        number: num,
        numberLabel: normalizedStr,
        originalLabel: rawOriginalNumeric,
        title: subtitle,
        publishedAt,
      };
    }
  }

  // 3. Genuine Special Chapter (e.g. "Prologue", "Special Extra", "Side Story", "Special Extra: Room 302")
  return {
    number: null,
    numberLabel: null,
    originalLabel: text,
    title: text,
    publishedAt,
  };
}

function duplicateNumbers(items: ChapterItem[]): void {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.numberLabel) counts.set(item.numberLabel, (counts.get(item.numberLabel) ?? 0) + 1);
  }
  for (const item of items) {
    item.duplicateNumber = !!item.numberLabel && (counts.get(item.numberLabel) ?? 0) > 1;
  }
}

export function normalizeChapters(html: string, mangaId: string, page: number, limit: number): ChaptersResponse {
  const all = new Map<string, ChapterItem>();
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  const matches = [...html.matchAll(anchorRegex)];

  for (let i = 0; i < matches.length; i++) {
    const fullMatch = matches[i];
    const openTag = `<a${fullMatch[1]}>`;
    const innerHtml = fullMatch[2];
    const hrefMatch = openTag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const rawHref = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? null;
    const href = safeUrl(rawHref, SITE);
    if (!href || new URL(href).hostname !== new URL(SITE).hostname) continue;
    const url = new URL(href);
    const match = url.pathname.match(/^\/chapters\/([0-9A-HJKMNP-TV-Z]{26})\/?$/i);
    if (!match) continue;
    const id = match[1].toUpperCase();

    // Capture sibling markup between this </a> and the next <a (capped at 400 chars) in case <time> is outside <a>
    const endIdx = (fullMatch.index ?? 0) + fullMatch[0].length;
    const nextStartIdx = i + 1 < matches.length ? (matches[i + 1].index ?? endIdx + 400) : endIdx + 400;
    const siblingSnippet = html.slice(endIdx, Math.min(nextStartIdx, endIdx + 400));

    const parsed = parseWeebCentralChapterLabel(innerHtml, siblingSnippet);
    all.set(id, {
      id,
      sourceId: "weebcentral",
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
      sourceUrl: href,
      duplicateNumber: false,
    });
  }

  const ordered = [...all.values()].sort(
    (a, b) =>
      (a.number === null ? 1 : 0) - (b.number === null ? 1 : 0) ||
      (a.number ?? 0) - (b.number ?? 0) ||
      a.id.localeCompare(b.id),
  );
  duplicateNumbers(ordered);
  const items = ordered.slice((page - 1) * limit, page * limit);
  return { items, total: ordered.length, page, limit, hasMore: page * limit < ordered.length };
}

export function normalizePages(html: string, chapterId: string, requestedMangaId?: string): ChapterPages {
  const pages = voidElements(html, "img")
    .flatMap((image) => {
      const number = Number.parseInt(image.alt?.match(/page\s+(\d+)/i)?.[1] ?? "", 10);
      const imageUrl = safeUrl(image.src ?? image["data-src"] ?? null, SITE);
      return number > 0 && imageUrl ? [{ pageNumber: number, imageUrl, width: null, height: null }] : [];
    })
    .sort((a, b) => a.pageNumber - b.pageNumber);
  if (!pages.length) throw new SourceError("BAD_RESPONSE", "WeebCentral did not return readable chapter pages.");
  const title = htmlText(metaContent(html, "property", "og:title") ?? "");
  const seriesLink = elements(html, "a")
    .map((anchor) => anchor.attrs.href ?? "")
    .find((href) => !!sourceIdFromUrl(href));
  const mangaId = requestedMangaId?.toUpperCase() ?? (seriesLink ? sourceIdFromUrl(seriesLink) : null);
  const firstSegment = title.split("|")[0]?.trim() ?? "";
  const parsedHeader = parseWeebCentralChapterLabel(firstSegment);
  return {
    sourceId: "weebcentral",
    mangaId,
    chapterId,
    chapterTitle: title.replace(/\s*\|\s*Weeb Central\s*$/i, "") || null,
    chapterNumber: parsedHeader.numberLabel,
    language: "en",
    pages,
    groups: [],
    sourceUrl: `${SITE}/chapters/${encodeURIComponent(chapterId)}`,
  };
}
