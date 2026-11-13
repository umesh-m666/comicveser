import { parseWeebCentralChapterLabel } from "./weebcentral.normalize";

const GENUINE_SPECIAL_RE = /^(?:special(?:\s+extra|\s+chapter|\s+episode)?|prologue|epilogue|side\s*story|extra|bonus|afterword|omake|hiatus|notice|announcement)(?:\b|\s*[-–—:·])/i;

/**
 * Resolves the user-facing display number for a ComicVerse chapter.
 * Never classifies a numbered episode (e.g. "Episode 10", "Ep. 10", "Chapter 10.5", "001") as "Special",
 * even if an older database record stored numberLabel=null with "Episode 10" in title/originalLabel.
 */
export function resolveChapterDisplayNumber(
  chapter: { number: number; title?: string | null },
  sourceChapter?: { numberLabel?: string | null; originalLabel?: string | null; title?: string | null } | null,
): string {
  if (!sourceChapter) {
    return String(chapter.number);
  }

  // 1. Check explicit numberLabel first
  if (sourceChapter.numberLabel && sourceChapter.numberLabel.trim()) {
    const trimmed = sourceChapter.numberLabel.trim();
    const parsed = parseWeebCentralChapterLabel(trimmed);
    if (parsed.number !== null && Number.isFinite(parsed.number)) {
      return String(parsed.number);
    }
    const directFloat = Number.parseFloat(trimmed);
    if (Number.isFinite(directFloat) && /^\d+(?:\.\d+)?$/.test(trimmed)) {
      return String(directFloat);
    }
    return trimmed;
  }

  // 2. Check originalLabel, sourceChapter.title, and chapter.title for Episode/Chapter numbers
  const candidates = [sourceChapter.originalLabel, sourceChapter.title, chapter.title].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  for (const candidate of candidates) {
    const clean = candidate.trim();
    if (GENUINE_SPECIAL_RE.test(clean)) {
      return "Special";
    }
    const parsed = parseWeebCentralChapterLabel(clean);
    if (parsed.number !== null && Number.isFinite(parsed.number)) {
      return String(parsed.number);
    }
  }

  // 3. If none of the titles indicate a special chapter and chapter.number is a positive number,
  // check whether the title was defaulted to "Special chapter" when chapter.number was assigned sequentially.
  const anySpecialTitle = candidates.some((c) => /^special\b/i.test(c.trim()));
  if (anySpecialTitle) {
    return "Special";
  }

  return Number.isFinite(chapter.number) ? String(chapter.number) : "Special";
}

/**
 * Resolves the accurate release timestamp for a chapter.
 * For source-backed chapters, prefers the genuine sourceChapter.publishedAt release date.
 */
export function resolveChapterPublishedAt(
  chapter: { publishedAt?: Date | null },
  sourceChapter?: { publishedAt?: Date | null } | null,
): Date | null {
  if (sourceChapter !== undefined && sourceChapter !== null) {
    return sourceChapter.publishedAt ?? chapter.publishedAt ?? null;
  }
  return chapter.publishedAt ?? null;
}
