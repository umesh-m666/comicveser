"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeebCentralProvider = void 0;
const provider_interface_1 = require("./provider.interface");
const weebcentral_normalize_1 = require("./weebcentral.normalize");
const SITE = "https://weebcentral.com";
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const MAX_OFFSET = 10_000;
class WeebCentralProvider {
    id = "weebcentral";
    displayName = "WeebCentral";
    config;
    doFetch;
    minimumIntervalMs;
    lastRequestAt = 0;
    requestQueue = Promise.resolve();
    chapterCache = new Map();
    constructor(config, doFetch = fetch, minimumIntervalMs = 10_000) {
        this.config = config;
        this.doFetch = doFetch;
        this.minimumIntervalMs = minimumIntervalMs;
    }
    info() {
        return {
            id: this.id, displayName: this.displayName, officialUrl: SITE,
            attribution: "Titles and chapters are provided by WeebCentral. Please support the creators.",
            capabilities: { search: true, details: true, chapters: true, pages: true, types: ["manga", "manhwa", "manhua"], languages: ["en"] },
            notes: ["Search and Show All use WeebCentral's public advanced catalogue page with offset pagination.", "WeebCentral catalogue requests respect the configured crawl delay.", "Chapter images are linked directly from the source and are not stored by ComicVerse."],
        };
    }
    async response(url, accept, init = {}) {
        const operation = async () => {
            const delay = Math.max(0, this.lastRequestAt + this.minimumIntervalMs - Date.now());
            if (delay)
                await new Promise((resolve) => setTimeout(resolve, delay));
            this.lastRequestAt = Date.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
            try {
                let response;
                try {
                    const headers = new Headers(init.headers);
                    headers.set("User-Agent", this.config.userAgent);
                    headers.set("Accept", accept);
                    response = await this.doFetch(url, {
                        ...init,
                        headers,
                        signal: controller.signal,
                    });
                }
                catch (error) {
                    if (controller.signal.aborted || error?.name === "AbortError") {
                        throw new provider_interface_1.SourceError("SOURCE_TIMEOUT", "WeebCentral took too long to respond. Try again in a moment.");
                    }
                    throw new provider_interface_1.SourceError("SOURCE_UNAVAILABLE", "WeebCentral could not be reached right now.");
                }
                if (!response.ok) {
                    if (response.status === 404)
                        throw new provider_interface_1.SourceError("NOT_FOUND", "That title or chapter was not found on WeebCentral.");
                    if (response.status === 429) {
                        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
                        throw new provider_interface_1.SourceError("SOURCE_RATE_LIMITED", "WeebCentral is limiting requests right now. Please wait a moment.", Number.isFinite(retryAfter) ? retryAfter : undefined);
                    }
                    if (response.status === 400 || response.status === 422)
                        throw new provider_interface_1.SourceError("INVALID_REQUEST", "WeebCentral did not accept that request.");
                    if (response.status === 401 || response.status === 403)
                        throw new provider_interface_1.SourceError("SOURCE_UNAVAILABLE", "WeebCentral refused the request, so this source is unavailable.");
                    throw new provider_interface_1.SourceError(response.status >= 500 ? "SOURCE_UNAVAILABLE" : "BAD_RESPONSE", "WeebCentral is having problems right now.");
                }
                return response;
            }
            finally {
                clearTimeout(timer);
            }
        };
        const result = this.requestQueue.then(operation, operation);
        this.requestQueue = result.then(() => undefined, () => undefined);
        return result;
    }
    async html(url, init) {
        try {
            return await (await this.response(url, "text/html", init)).text();
        }
        catch (error) {
            if (error instanceof provider_interface_1.SourceError)
                throw error;
            throw new provider_interface_1.SourceError("BAD_RESPONSE", "WeebCentral sent a response we could not read.");
        }
    }
    async health() {
        const started = Date.now();
        try {
            await this.html(SITE);
            return { ok: true, latencyMs: Date.now() - started };
        }
        catch (error) {
            return { ok: false, latencyMs: Date.now() - started, message: error instanceof provider_interface_1.SourceError ? error.message : "Health check failed" };
        }
    }
    async search(query) {
        const supportedTypes = ["manga", "manhwa", "manhua"];
        if (query.type && !supportedTypes.includes(query.type)) {
            throw new provider_interface_1.SourceError("INVALID_REQUEST", `WeebCentral does not support the "${query.type}" type.`);
        }
        // The quick-search fragment only returns suggestions for a non-empty term.
        // The advanced /search page is the site's catalogue view and also supports
        // an empty text parameter, which is what the admin Show All action needs.
        const page = Math.max(1, Math.floor(query.page || 1));
        const limit = Math.min(24, Math.max(1, Math.floor(query.limit || 20)));
        const offset = (page - 1) * limit;
        if (offset > MAX_OFFSET)
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "WeebCentral catalogue pagination is limited to the first 10,000 results.");
        const url = new URL("/search/data", SITE);
        url.search = new URLSearchParams({
            text: query.q?.trim() ?? "",
            limit: String(limit),
            offset: String(offset),
            display_mode: "Full Display",
        }).toString();
        const html = await this.html(url.toString());
        return (0, weebcentral_normalize_1.normalizeSearch)(html, { ...query, q: query.q?.trim() ?? "", page, limit });
    }
    async details(externalId) {
        if (!ULID.test(externalId))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That title id is not valid.");
        const html = await this.html(new URL(`/series/${encodeURIComponent(externalId)}`, SITE).toString());
        return (0, weebcentral_normalize_1.normalizeDetails)(html, externalId.toUpperCase());
    }
    async fullChapterList(mangaId) {
        const cached = this.chapterCache.get(mangaId);
        if (cached && cached.expiresAt > Date.now())
            return cached.html;
        const html = await this.html(new URL(`/series/${encodeURIComponent(mangaId)}/full-chapter-list`, SITE).toString());
        this.chapterCache.set(mangaId, { html, expiresAt: Date.now() + 10 * 60_000 });
        return html;
    }
    async chapters(externalId, options) {
        if (!ULID.test(externalId))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That title id is not valid.");
        if (options.language.toLowerCase() !== "en")
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "WeebCentral only lists English chapters.");
        const limit = Math.min(Math.max(options.limit, 1), 500);
        const page = Math.max(options.page, 1);
        if ((page - 1) * limit + limit > MAX_OFFSET)
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "Chapter pagination is limited to the first 10,000 results.");
        return (0, weebcentral_normalize_1.normalizeChapters)(await this.fullChapterList(externalId.toUpperCase()), externalId.toUpperCase(), page, limit);
    }
    async pages(chapterId, options, mangaId) {
        void options;
        if (!ULID.test(chapterId))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That chapter id is not valid.");
        if (mangaId && !ULID.test(mangaId))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That title id is not valid.");
        const url = new URL(`/chapters/${encodeURIComponent(chapterId)}/images?is_prev=False`, SITE);
        return (0, weebcentral_normalize_1.normalizePages)(await this.html(url.toString()), chapterId.toUpperCase(), mangaId);
    }
}
exports.WeebCentralProvider = WeebCentralProvider;
//# sourceMappingURL=weebcentral.provider.js.map