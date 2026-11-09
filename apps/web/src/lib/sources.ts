import { API } from "./api";

export interface SourceInfo { id: string; displayName: string; officialUrl: string; attribution: string; notes: string[]; capabilities: { search: boolean; details: boolean; chapters: boolean; pages: boolean; types: string[]; languages: string[] | null } }
export interface Manga {
  id: string; externalId: string; sourceId: string; title: string; alternativeTitles: string[];
  coverUrl: string | null; description: string | null; status: string | null; genres: string[];
  contentType: string; language: string | null; sourceUrl: string;
  authors?: string[]; artists?: string[]; year?: number | null; availableLanguages?: string[];
}
export interface MangaDetails extends Manga {
  authors: string[];
  artists: string[];
  year: number | null;
  availableLanguages: string[];
  metadataFallback?: "search";
}
export interface Paged<T> { items: T[]; total: number; totalExact?: boolean; page: number; limit: number; hasMore: boolean }
export interface ExtChapter { id: string; sourceId?: string; mangaId?: string; number: number | null; numberLabel: string | null; title: string | null; volume: string | null; language: string | null; publishedAt: string | null; groups: string[]; pageCount: number | null; sourceUrl: string; duplicateNumber: boolean }
export interface AlternativeChapter extends ExtChapter {
  sourceId: string;
  mangaId: string;
  readerUrl: string;
  imported?: boolean;
}
export interface AlternativeSourceMatch {
  sourceId: string;
  sourceName: string;
  externalId: string;
  title: string;
  coverUrl: string | null;
  sourceUrl: string;
  catalogUrl: string;
  adminReviewUrl: string;
  totalChapters: number;
  chapters: AlternativeChapter[];
  matchedChapter?: AlternativeChapter | null;
}
export interface ExtPages { chapterId: string; mangaId: string | null; chapterTitle: string | null; chapterNumber: string | null; language: string | null; groups: string[]; sourceUrl: string; pages: { pageNumber: number; imageUrl: string; width: number | null; height: number | null }[] }

/** Source covers can be direct URLs or API-relative proxy paths. */
export const media = (p?: string | null) => (p ? (/^https?:\/\//.test(p) ? p : `${API}${p}`) : null);
export const hueOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
export const LANGUAGES: [string, string][] = [["en", "English"], ["es", "Spanish"], ["es-la", "Spanish (LATAM)"], ["fr", "French"], ["pt-br", "Portuguese (BR)"], ["id", "Indonesian"], ["ru", "Russian"], ["it", "Italian"], ["de", "German"], ["pl", "Polish"], ["tr", "Turkish"], ["vi", "Vietnamese"], ["ja", "Japanese"]];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
