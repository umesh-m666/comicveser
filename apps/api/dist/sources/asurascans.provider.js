"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsuraScansProvider = void 0;
const provider_interface_1 = require("./provider.interface");
const asurascans_normalize_1 = require("./asurascans.normalize");
const SITE = "https://asurascans.com";
const API = "https://api.asurascans.com";
const MAX_OFFSET = 10_000;
class AsuraScansProvider {
    id = "asurascans";
    displayName = "Asura Scans";
    config;
    doFetch;
    chapterCache = new Map();
    constructor(config, doFetch = fetch) {
        this.config = config;
        this.doFetch = doFetch;
    }
    info() {
        return {
            id: this.id, displayName: this.displayName, officialUrl: SITE,
            attribution: "Titles and chapters are provided by Asura Scans. Please support the creators.",
            capabilities: { search: true, details: true, chapters: true, pages: true, types: ["manga", "manhwa", "manhua"], languages: ["en"] },
            notes: ["Search and chapter lists use Asura Scans' publicly linked API and pages.", "Chapter images are linked directly from Asura Scans' CDN and are not stored by ComicVerse."],
        };
    }
    async request(url, accept) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
            let response;
            try {
                response = await this.doFetch(url, {
                    headers: { "User-Agent": this.config.userAgent, Accept: accept },
                    signal: controller.signal,
                });
            }
            catch (error) {
                if (controller.signal.aborted || error?.name === "AbortError") {
                    throw new provider_interface_1.SourceError("SOURCE_TIMEOUT", "Asura Scans took too long to respond. Try again in a moment.");
                }
                throw new provider_interface_1.SourceError("SOURCE_UNAVAILABLE", "Asura Scans could not be reached right now.");
            }
            if (!response.ok) {
                if (response.status === 404)
                    throw new provider_interface_1.SourceError("NOT_FOUND", "That title or chapter was not found on Asura Scans.");
                if (response.status === 429) {
                    const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
                    throw new provider_interface_1.SourceError("SOURCE_RATE_LIMITED", "Asura Scans is limiting requests right now. Please wait a moment.", Number.isFinite(retryAfter) ? retryAfter : undefined);
                }
                if (response.status === 400 || response.status === 422)
                    throw new provider_interface_1.SourceError("INVALID_REQUEST", "Asura Scans did not accept that request.");
                if (response.status === 401 || response.status === 403)
                    throw new provider_interface_1.SourceError("SOURCE_UNAVAILABLE", "Asura Scans refused the request, so this source is unavailable.");
                throw new provider_interface_1.SourceError(response.status >= 500 ? "SOURCE_UNAVAILABLE" : "BAD_RESPONSE", "Asura Scans is having problems right now.");
            }
            return response;
        }
        finally {
            clearTimeout(timer);
        }
    }
    async json(url) {
        const response = await this.request(url, "application/json");
        try {
            return await response.json();
        }
        catch {
            throw new provider_interface_1.SourceError("BAD_RESPONSE", "Asura Scans sent a response we could not read.");
        }
    }
    async html(url) {
        const response = await this.request(url, "text/html");
        try {
            return await response.text();
        }
        catch {
            throw new provider_interface_1.SourceError("BAD_RESPONSE", "Asura Scans sent a response we could not read.");
        }
    }
    seriesSearchUrl(search, limit, offset) {
        const url = new URL("/api/series", API);
        url.searchParams.set("search", search);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));
        return url.toString();
    }
    async health() {
        const started = Date.now();
        try {
            await this.json(this.seriesSearchUrl("comic", 1, 0));
            return { ok: true, latencyMs: Date.now() - started };
        }
        catch (error) {
            return { ok: false, latencyMs: Date.now() - started, message: error instanceof provider_interface_1.SourceError ? error.message : "Health check failed" };
        }
    }
    async search(query) {
        if (query.type && !["manga", "manhwa", "manhua"].includes(query.type)) {
            throw new provider_interface_1.SourceError("INVALID_REQUEST", `Asura Scans does not support the "${query.type}" type.`);
        }
        const limit = Math.min(Math.max(query.limit, 1), 24);
        const offset = (Math.max(query.page, 1) - 1) * limit;
        if (offset + limit > MAX_OFFSET)
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "Search only reaches the first 10,000 results. Try a more specific search.");
        const url = new URL(this.seriesSearchUrl(query.q, limit, offset));
        if (query.type)
            url.searchParams.set("type", query.type);
        return (0, asurascans_normalize_1.normalizeSearch)(await this.json(url.toString()), query);
    }
    async details(externalId) {
        if (!/^[a-z0-9-]{2,100}$/i.test(externalId))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That title id is not valid.");
        const url = this.seriesSearchUrl(externalId.replace(/-[a-f0-9]{8}$/i, ""), 20, 0);
        const raw = await this.json(url);
        const rows = raw && typeof raw === "object" && Array.isArray(raw.data)
            ? raw.data
            : [];
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.data)) {
            throw new provider_interface_1.SourceError("BAD_RESPONSE", "Asura Scans sent a response we could not read.");
        }
        const item = rows.find((row) => {
            const publicUrl = row && typeof row === "object" ? row.public_url : null;
            return typeof publicUrl === "string" && publicUrl.split("/").filter(Boolean).at(-1) === externalId;
        });
        if (!item)
            throw new provider_interface_1.SourceError("NOT_FOUND", "That title was not found on Asura Scans.");
        return (0, asurascans_normalize_1.normalizeDetails)(item);
    }
    async chapterHtml(mangaId) {
        const cached = this.chapterCache.get(mangaId);
        if (cached && cached.expiresAt > Date.now())
            return cached.html;
        const url = new URL(`/comics/${encodeURIComponent(mangaId)}`, SITE);
        const html = await this.html(url.toString());
        this.chapterCache.set(mangaId, { html, expiresAt: Date.now() + 10 * 60_000 });
        return html;
    }
    async chapters(externalId, options) {
        if (!/^[a-z0-9-]{2,100}$/i.test(externalId))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That title id is not valid.");
        if (options.language.toLowerCase() !== "en")
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "Asura Scans only lists English chapters.");
        const limit = Math.min(Math.max(options.limit, 1), 500);
        const page = Math.max(options.page, 1);
        if ((page - 1) * limit + limit > MAX_OFFSET)
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "Chapter pagination is limited to the first 10,000 results.");
        return (0, asurascans_normalize_1.normalizeChapters)(await this.chapterHtml(externalId), externalId, page, limit);
    }
    async pages(chapterId, options, mangaId) {
        void options;
        if (!mangaId || !/^[a-z0-9-]{2,100}$/i.test(mangaId) || !/^[a-z0-9.-]+$/i.test(chapterId)) {
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That chapter id is not valid.");
        }
        const url = new URL(`/comics/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(chapterId)}`, SITE);
        return (0, asurascans_normalize_1.normalizePages)(await this.html(url.toString()), mangaId, chapterId);
    }
}
exports.AsuraScansProvider = AsuraScansProvider;
//# sourceMappingURL=asurascans.provider.js.map