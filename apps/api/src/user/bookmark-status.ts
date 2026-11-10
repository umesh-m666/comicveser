/** Pure helpers for bookmark shelves and reading progress (no database access, unit-tested). */

export const BOOKMARK_STATUSES = ["READING", "COMPLETED", "PLAN_TO_READ", "ON_HOLD", "DROPPED"] as const;
export type BookmarkStatusValue = (typeof BOOKMARK_STATUSES)[number];

export const BOOKMARK_SORTS = ["updated", "added", "title", "recent"] as const;
export type BookmarkSortValue = "updated" | "added" | "title";

/** "recent" is the pre-redesign name for "recently added"; keep it working for older clients. */
export const normalizeSort = (s?: string): BookmarkSortValue => (s === "title" ? "title" : s === "added" || s === "recent" ? "added" : "updated");

export interface StatusInput {
  /** The shelf the reader picked, or null for automatic. */
  manual: BookmarkStatusValue | null;
  /** Distinct published chapters the reader has finished. */
  readCount: number;
  /** True when the reader has an in-progress position in this comic. */
  hasHistory: boolean;
  /** Published chapters in the comic. */
  totalChapters: number;
  /** Comic publication status is COMPLETED (no more chapters expected). */
  comicCompleted: boolean;
}

/**
 * Manual shelf wins. Otherwise: untouched = Plan to Read; every chapter of a finished comic read = Completed;
 * anything else that has been started = Reading.
 */
export function effectiveStatus(i: StatusInput): BookmarkStatusValue {
  if (i.manual) return i.manual;
  if (i.readCount === 0 && !i.hasHistory) return "PLAN_TO_READ";
  if (i.comicCompleted && i.totalChapters > 0 && i.readCount >= i.totalChapters) return "COMPLETED";
  return "READING";
}

/** Whole-number percentage of chapters finished, clamped to 0-100. */
export function progressPercent(readCount: number, totalChapters: number): number {
  if (!(totalChapters > 0) || !(readCount > 0)) return 0;
  return Math.min(100, Math.round((readCount / totalChapters) * 100));
}

export interface SortableBookmark { title: string; bookmarkedAt: Date; lastUpdatedAt: Date }
export function sortBookmarks<T extends SortableBookmark>(items: T[], sort: BookmarkSortValue): T[] {
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  return [...items].sort((a, b) =>
    sort === "title" ? byTitle(a, b)
      : sort === "added" ? b.bookmarkedAt.getTime() - a.bookmarkedAt.getTime() || byTitle(a, b)
        : b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime() || byTitle(a, b));
}
