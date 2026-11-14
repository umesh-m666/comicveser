// Data-access layer backed by the ComicVerse API.
import { API, api } from "./api";
export type ComicType = "Manga" | "Manhwa" | "Manhua" | "Webtoon";
export type ComicStatus = "Ongoing" | "Completed" | "Hiatus";

export interface Chapter { id: string; number: number; displayNumber?: string; title: string; publishedAt: string }
export interface Comic {
  id: string; slug: string; title: string; altTitle?: string; description: string;
  author: string; artist: string; genres: string[]; type: ComicType;
  status: ComicStatus; year: number; rating: number; hue: number;
  views: number; addedAt: string; updatedAt: string; chapters: Chapter[]; chapterCount: number; latest: Chapter | null; coverUrl: string | null;
}

export const GENRES = ["Action","Adventure","Fantasy","Romance","Comedy","Drama","Martial Arts","Mystery","Horror","Supernatural","Sci-Fi","Historical","Reincarnation","Regression","School Life"];
export const TYPES: ComicType[] = ["Manga","Manhwa","Manhua","Webtoon"];
export const STATUSES: ComicStatus[] = ["Ongoing","Completed","Hiatus"];
export const SORTS = [
  ["updated","Latest update"],["added","Recently added"],["rating","Highest rated"],["popular","Most popular"],
  ["chapters","Most chapters"],["alpha","Alphabetical"],
] as const;
export const MIN_CHAPTER_OPTIONS = [10, 25, 50, 100, 200] as const;

export const chapterLabel = (c: Chapter) => c.displayNumber ?? String(c.number);

/** "5 minutes ago", "3 days ago", or a short date once older than a month. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t <= 0) return "";
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const NO_CHAPTER: Chapter = { id: "", number: 0, title: "", publishedAt: new Date(0).toISOString() };
export const latestChapter = (c: Comic): Chapter => c.latest ?? c.chapters[c.chapters.length - 1] ?? NO_CHAPTER;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const cap = (s: string) => s[0] + s.slice(1).toLowerCase();
const hueOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export interface ApiComic {
  id: string; slug: string; title: string; altTitle: string | null; description: string; author: string; artist: string;
  type: string; status: string; releaseYear: number; views: number; createdAt: string; updatedAt: string;
  genres: { genre: { name: string } }[]; rating: number | null; chapterCount?: number; coverUrl?: string | null; bannerUrl?: string | null;
  latestChapter: { id: string; number: number; displayNumber?: string; publishedAt: string | null } | null;
}
const toChapter = (c: { id: string; number: number; displayNumber?: string; title?: string; publishedAt: string | null }): Chapter =>
  ({ id: c.id, number: c.number, displayNumber: c.displayNumber, title: c.title ?? `Chapter ${c.displayNumber ?? c.number}`, publishedAt: c.publishedAt ?? new Date(0).toISOString() });

export const toComic = (a: ApiComic, chapters: Chapter[] = []): Comic => ({
  id: a.id, slug: a.slug, title: a.title, altTitle: a.altTitle ?? undefined, description: a.description, author: a.author, artist: a.artist,
  genres: a.genres.map((g) => g.genre.name), type: cap(a.type) as ComicType, status: cap(a.status) as ComicStatus, year: a.releaseYear,
  rating: a.rating ?? 0, hue: hueOf(a.slug), views: a.views, addedAt: a.createdAt, updatedAt: a.updatedAt,
  chapters, chapterCount: a.chapterCount ?? chapters.length, latest: a.latestChapter ? toChapter(a.latestChapter) : null,
  coverUrl: a.coverUrl ? (/^https?:\/\//i.test(a.coverUrl) ? a.coverUrl : `${API}${a.coverUrl}`) : null,
});

function dedupeComicsByTitle(items: Comic[]): Comic[] {
  const byTitle = new Map<string, Comic>();
  for (const item of items) {
    const key = item.title.trim().toLowerCase().replace(/^official\s+/i, "").replace(/[^a-z0-9]+/g, "") || item.id;
    const prev = byTitle.get(key);
    if (!prev || item.addedAt.localeCompare(prev.addedAt) > 0) {
      byTitle.set(key, item);
    }
  }
  return Array.from(byTitle.values());
}

export interface BrowseQuery {
  q?: string; genre?: string; type?: string; status?: string; creator?: string; minChapters?: string;
  minRating?: string; year?: string; sort?: string; page?: string;
}
export const PAGE_SIZE = 24;

export async function browseComics(p: BrowseQuery) {
  const sp = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(Math.max(1, Number(p.page) || 1)) });
  if (p.q?.trim()) sp.set("q", p.q.trim().slice(0, 100));
  // `genre` is a comma-separated list of genre names; a comic must match every selected genre.
  const genres = (p.genre ?? "").split(",").map((g) => g.trim()).filter((g) => GENRES.includes(g));
  if (genres.length) sp.set("genre", genres.map(slugify).join(","));
  if (p.creator?.trim()) sp.set("creator", p.creator.trim().slice(0, 100));
  if (p.minChapters && Number(p.minChapters) >= 1) sp.set("minChapters", String(Math.min(5000, Math.floor(Number(p.minChapters)))));
  if (p.type && (TYPES as string[]).includes(p.type)) sp.set("type", p.type.toUpperCase());
  if (p.status && (STATUSES as string[]).includes(p.status)) sp.set("status", p.status.toUpperCase());
  if (p.minRating && Number(p.minRating) >= 1 && Number(p.minRating) <= 10) sp.set("minRating", p.minRating);
  if (p.year && /^\d{4}$/.test(p.year)) sp.set("year", p.year);
  if (p.sort && SORTS.some(([v]) => v === p.sort)) sp.set("sort", p.sort);
  const r = await api<{ items: ApiComic[]; total: number; page: number; pages: number }>(`/comics?${sp}`, { cache: "no-store" });
  const mapped = dedupeComicsByTitle(r.items.map((a) => toComic(a)));
  return { total: Math.max(mapped.length, r.total - (r.items.length - mapped.length)), page: r.page, pages: r.pages, items: mapped };
}

export type PopularPeriod = "weekly" | "monthly" | "all";

/** Real period rankings (recorded views); the API pads with all-time leaders when a period is quiet. */
export async function popularComics(period: PopularPeriod): Promise<Comic[]> {
  try {
    const items = await api<ApiComic[]>(`/comics/popular?period=${period}`, { cache: "no-store" });
    return dedupeComicsByTitle(items.map((a) => toComic(a)));
  } catch {
    return [];
  }
}

export async function allComics() {
  try {
    const r = await api<{ items: ApiComic[] }>("/comics?pageSize=48&sort=popular", { cache: "no-store" });
    return dedupeComicsByTitle(r.items.map((a) => toComic(a)));
  } catch {
    return [];
  }
}

export async function getComic(slug: string): Promise<Comic | null> {
  try {
    const a = await api<ApiComic>(`/comics/${encodeURIComponent(slug)}`, { cache: "no-store" });
    const ch = await api<{ id: string; number: number; displayNumber?: string; title: string; publishedAt: string | null }[]>(`/comics/${a.id}/chapters?order=asc`, { cache: "no-store" });
    return toComic(a, ch.map(toChapter));
  } catch {
    return null;
  }
}

// Release-year choices for the filter (last 6 years).
export const years = () => Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

export async function getAnnouncements() {
  try { return await api<{ id: string; title: string; body: string }[]>("/announcements", { cache: "no-store" }); }
  catch { return []; } // announcements are optional; never break the homepage
}

export async function getNovels() {
  try {
    const r = await api<{ items: { slug: string; title: string; author: string; chapterCount: number }[] }>("/novels?page=1", { cache: "no-store" });
    return r.items.slice(0, 3).map((n) => ({ slug: n.slug, title: n.title, author: n.author, chapters: n.chapterCount, hue: hueOf(n.slug) }));
  } catch { return []; }
}
