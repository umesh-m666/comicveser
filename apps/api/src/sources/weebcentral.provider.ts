import { SourceError } from "./provider.interface";
import type { ChapterPages, ChaptersResponse, HealthResult, MangaDetails, MangaSourceProvider, SearchQuery, SearchResponse, SourceInfo } from "./provider.interface";
import { normalizeChapters, normalizeDetails, normalizePages, normalizeSearch } from "./weebcentral.normalize";
import type { SourcesConfig } from "./sources.config";

const SITE = "https://weebcentral.com";
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const MAX_OFFSET = 10_000;

export class WeebCentralProvider implements MangaSourceProvider {
  readonly id = "weebcentral";
  readonly displayName = "WeebCentral";
  private readonly config: SourcesConfig;
  private readonly doFetch: typeof fetch;
  private readonly minimumIntervalMs: number;
  private lastRequestAt = 0;
  private requestQueue: Promise<void> = Promise.resolve();
  private readonly chapterCache = new Map<string, { expiresAt: number; html: string }>();

  constructor(config: SourcesConfig, doFetch: typeof fetch = fetch, minimumIntervalMs = 10_000) {
    this.config = config;
    this.doFetch = doFetch;
    this.minimumIntervalMs = minimumIntervalMs;
  }

  info(): SourceInfo {
    return {
      id: this.id, displayName: this.displayName, officialUrl: SITE,
      attribution: "Titles and chapters are provided by WeebCentral. Please support the creators.",
      capabilities: { search: true, details: true, chapters: true, pages: true, types: ["manga", "manhwa", "manhua"], languages: ["en"] },
      notes: ["Search and Show All use WeebCentral's public advanced catalogue page with offset pagination.", "WeebCentral catalogue requests respect the configured crawl delay.", "Chapter images are linked directly from the source and are not stored by ComicVerse."],
    };
  }

  private async response(url: string, accept: string, init: RequestInit = {}): Promise<Response> {
    const operation = async () => {
      const delay = Math.max(0, this.lastRequestAt + this.minimumIntervalMs - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      this.lastRequestAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        let response: Response;
        try {
          const headers = new Headers(init.headers);
          headers.set("User-Agent", this.config.userAgent);
          headers.set("Accept", accept);
          response = await this.doFetch(url, {
            ...init,
            headers,
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted || (error as Error)?.name === "AbortError") {
            throw new SourceError("SOURCE_TIMEOUT", "WeebCentral took too long to respond. Try again in a moment.");
          }
          throw new SourceError("SOURCE_UNAVAILABLE", "WeebCentral could not be reached right now.");
        }
        if (!response.ok) {
          if (response.status === 404) throw new SourceError("NOT_FOUND", "That title or chapter was not found on WeebCentral.");
          if (response.status === 429) {
            const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
            throw new SourceError("SOURCE_RATE_LIMITED", "WeebCentral is limiting requests right now. Please wait a moment.", Number.isFinite(retryAfter) ? retryAfter : undefined);
          }
          if (response.status === 400 || response.status === 422) throw new SourceError("INVALID_REQUEST", "WeebCentral did not accept that request.");
          if (response.status === 401 || response.status === 403) throw new SourceError("SOURCE_UNAVAILABLE", "WeebCentral refused the request, so this source is unavailable.");
          throw new SourceError(response.status >= 500 ? "SOURCE_UNAVAILABLE" : "BAD_RESPONSE", "WeebCentral is having problems right now.");
        }
        return response;
      } finally {
        clearTimeout(timer);
      }
    };
    const result = this.requestQueue.then(operation, operation);
    this.requestQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async html(url: string, init?: RequestInit): Promise<string> {
    try { return await (await this.response(url, "text/html", init)).text(); }
    catch (error) {
      if (error instanceof SourceError) throw error;
      throw new SourceError("BAD_RESPONSE", "WeebCentral sent a response we could not read.");
    }
  }

  async health(): Promise<HealthResult> {
    const started = Date.now();
    try {
      await this.html(SITE);
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof SourceError ? error.message : "Health check failed" };
    }
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const supportedTypes = ["manga", "manhwa", "manhua"];
    if (query.type && !supportedTypes.includes(query.type)) {
      throw new SourceError("INVALID_REQUEST", `WeebCentral does not support the "${query.type}" type.`);
    }

    // The quick-search fragment only returns suggestions for a non-empty term.
    // The advanced /search page is the site's catalogue view and also supports
    // an empty text parameter, which is what the admin Show All action needs.
    const page = Math.max(1, Math.floor(query.page || 1));
    const limit = Math.min(24, Math.max(1, Math.floor(query.limit || 20)));
    const offset = (page - 1) * limit;
    if (offset > MAX_OFFSET) throw new SourceError("INVALID_REQUEST", "WeebCentral catalogue pagination is limited to the first 10,000 results.");

    const url = new URL("/search/data", SITE);
    url.search = new URLSearchParams({
      text: query.q?.trim() ?? "",
      limit: String(limit),
      offset: String(offset),
      display_mode: "Full Display",
    }).toString();
    const html = await this.html(url.toString());
    return normalizeSearch(html, { ...query, q: query.q?.trim() ?? "", page, limit });
  }

  async details(externalId: string): Promise<MangaDetails> {
    if (!ULID.test(externalId)) throw new SourceError("INVALID_REQUEST", "That title id is not valid.");
    const html = await this.html(new URL(`/series/${encodeURIComponent(externalId)}`, SITE).toString());
    return normalizeDetails(html, externalId.toUpperCase());
  }

  private async fullChapterList(mangaId: string): Promise<string> {
    const cached = this.chapterCache.get(mangaId);
    if (cached && cached.expiresAt > Date.now()) return cached.html;
    const html = await this.html(new URL(`/series/${encodeURIComponent(mangaId)}/full-chapter-list`, SITE).toString());
    this.chapterCache.set(mangaId, { html, expiresAt: Date.now() + 10 * 60_000 });
    return html;
  }

  async chapters(externalId: string, options: { language: string; page: number; limit: number }): Promise<ChaptersResponse> {
    if (!ULID.test(externalId)) throw new SourceError("INVALID_REQUEST", "That title id is not valid.");
    if (options.language.toLowerCase() !== "en") throw new SourceError("INVALID_REQUEST", "WeebCentral only lists English chapters.");
    const limit = Math.min(Math.max(options.limit, 1), 500);
    const page = Math.max(options.page, 1);
    if ((page - 1) * limit + limit > MAX_OFFSET) throw new SourceError("INVALID_REQUEST", "Chapter pagination is limited to the first 10,000 results.");
    return normalizeChapters(await this.fullChapterList(externalId.toUpperCase()), externalId.toUpperCase(), page, limit);
  }

  async pages(chapterId: string, options: { quality: "data" | "data-saver" }, mangaId?: string): Promise<ChapterPages> {
    void options;
    if (!ULID.test(chapterId)) throw new SourceError("INVALID_REQUEST", "That chapter id is not valid.");
    if (mangaId && !ULID.test(mangaId)) throw new SourceError("INVALID_REQUEST", "That title id is not valid.");
    const url = new URL(`/chapters/${encodeURIComponent(chapterId)}/images?is_prev=False`, SITE);
    return normalizePages(await this.html(url.toString()), chapterId.toUpperCase(), mangaId);
  }
}
