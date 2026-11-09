export interface NavChapter { id: string; number: number | null; numberLabel: string | null; title?: string | null; groups?: string[] }
export interface NavEntry { id: string; number: number; label?: string }
export interface ChapterPage<T> { items: T[]; hasMore: boolean }

export async function loadAllChapters<T extends NavChapter>(
  fetchPage: (page: number) => Promise<ChapterPage<T>>,
  maxPages = 100,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetchPage(page);
    items.push(...response.items);
    if (!response.hasMore) return items;
  }
  throw new Error("Chapter navigation exceeds the supported pagination limit.");
}

/**
 * Turns an ordered chapter list into reader navigation. Each release remains addressable by its unique id,
 * including alternate releases with the same chapter number. Unnumbered chapters get a position label.
 */
export function buildNav(items: NavChapter[], currentId: string) {
  const list: NavEntry[] = items.map((c, i) => {
    const parts = [c.numberLabel === null ? `Special ${i + 1}` : `Chapter ${c.numberLabel}`, c.title, c.groups?.join(", ")].filter(Boolean);
    return { id: c.id, number: c.number ?? i + 1, label: parts.join(" · ") };
  });
  const idx = list.findIndex((e) => e.id === currentId);
  if (idx < 0) return { list, current: null, prev: null, next: null };
  return {
    list,
    current: list[idx],
    prev: idx > 0 ? list[idx - 1] : null,
    next: idx < list.length - 1 ? list[idx + 1] : null,
  };
}
