export type ContentType = "manga" | "manhwa" | "manhua" | "webtoon" | "novel" | "unknown";

export type SourceErrorCode = "SOURCE_UNAVAILABLE" | "SOURCE_TIMEOUT" | "SOURCE_RATE_LIMITED" | "NOT_FOUND" | "BAD_RESPONSE" | "INVALID_REQUEST";
const STATUS: Record<SourceErrorCode, number> = { SOURCE_UNAVAILABLE: 503, SOURCE_TIMEOUT: 504, SOURCE_RATE_LIMITED: 429, NOT_FOUND: 404, BAD_RESPONSE: 502, INVALID_REQUEST: 400 };

/** A failure talking to an external source. Messages are safe to show to users (no URLs, no stack traces). */
export class SourceError extends Error {
  code: SourceErrorCode;
  status: number;
  retryAfterSeconds?: number;
  constructor(code: SourceErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "SourceError";
    this.code = code;
    this.status = STATUS[code];
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface SourceCapabilities { search: boolean; details: boolean; chapters: boolean; pages: boolean; types: ContentType[]; languages: string[] | null }
export interface SourceInfo { id: string; displayName: string; officialUrl: string; attribution: string; capabilities: SourceCapabilities; notes: string[] }

export interface SearchQuery { q: string; type?: ContentType; language?: string; page: number; limit: number }
export interface MangaSummary {
  id: string; externalId: string; sourceId: string; title: string; alternativeTitles: string[];
  coverUrl: string | null; description: string | null; status: string | null; genres: string[];
  contentType: ContentType; language: string | null; sourceUrl: string;
  /** Optional fields some search responses already provide; used if full details are challenged. */
  authors?: string[]; artists?: string[]; year?: number | null; availableLanguages?: string[];
}
export interface MangaDetails extends MangaSummary {
  authors: string[];
  artists: string[];
  year: number | null;
  availableLanguages: string[];
  /** Present when Comick's details route is challenged and search metadata is used as a limited fallback. */
  metadataFallback?: "search";
}
export interface Paged<T> { items: T[]; total: number; totalExact?: boolean; page: number; limit: number; hasMore: boolean }
export type SearchResponse = Paged<MangaSummary>;

export interface ChapterItem {
  id: string; sourceId: string; mangaId: string; number: number | null; numberLabel: string | null; title: string | null; volume: string | null;
  language: string | null; publishedAt: string | null; groups: string[]; pageCount: number | null; sourceUrl: string; duplicateNumber: boolean;
}
export type ChaptersResponse = Paged<ChapterItem>;
export interface ChapterPage { pageNumber: number; imageUrl: string; width: number | null; height: number | null }
export interface ChapterPages { sourceId: string; mangaId: string | null; chapterId: string; chapterTitle: string | null; chapterNumber: string | null; language: string | null; pages: ChapterPage[]; groups: string[]; sourceUrl: string }
export interface HealthResult { ok: boolean; latencyMs: number; message?: string }

export interface AlternativeChapterItem extends ChapterItem {
  readerUrl: string;
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
  chapters: AlternativeChapterItem[];
  matchedChapter?: AlternativeChapterItem | null;
}

export interface MangaSourceProvider {
  readonly id: string;
  readonly displayName: string;
  info(): SourceInfo;
  health(): Promise<HealthResult>;
  search(q: SearchQuery): Promise<SearchResponse>;
  /** Allows the service cache to restore search results into provider-local fallback memory. */
  rememberSearchResults?(items: SearchResponse["items"]): void;
  details(externalId: string): Promise<MangaDetails>;
  chapters(externalId: string, opts: { language: string; page: number; limit: number }): Promise<ChaptersResponse>;
  pages(chapterId: string, opts: { quality: "data" | "data-saver" }, mangaId?: string): Promise<ChapterPages>;
  cover?(mangaId: string, fileName: string): Promise<{ body: Buffer; contentType: string }>;
}
