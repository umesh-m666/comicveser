"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComicKProvider = void 0;
const provider_interface_1 = require("./provider.interface");
const comick_normalize_1 = require("./comick.normalize");
const SITE = "https://comick.dev";
const API = "https://api.comick.dev";
const PUBLIC_PROXY_API = "https://comick-api-proxy.notaspider.dev/api";
const MAX_OFFSET = 10_000;
const ID = /^[a-z0-9_-]{1,100}$/i;
const COUNTRY = { manga: "jp", manhwa: "kr", manhua: "zh" };
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
let gotScrapingPromise = null;
function loadGotScraping() {
    if (gotScrapingPromise)
        return gotScrapingPromise;
    gotScrapingPromise = Promise.resolve(null);
    return gotScrapingPromise;
}
function isCloudflareBody(status, bodyText, headers) {
    if (headers?.get("cf-mitigated") === "challenge")
        return true;
    if (status === 403 || status === 503) {
        if (/just a moment|cloudflare|attention required|challenge-platform|cf-challenge|cf_clearance/i.test(bodyText)) {
            return true;
        }
    }
    return false;
}
class ComicKProvider {
    id = "comick";
    displayName = "ComicK";
    config;
    doFetch;
    customFetch;
    inFlight = new Map();
    searchSummaryCache = new Map();
    slugToHid = new Map();
    chapterCache = new Map();
    detailsCloudflareBlockedUntil = 0;
    static SUMMARY_TTL_MS = 30 * 60 * 1000;
    static SUMMARY_CACHE_MAX = 1_000;
    constructor(config, doFetch = fetch) {
        this.config = config;
        this.doFetch = doFetch;
        this.customFetch = doFetch !== fetch;
    }
    info() {
        return {
            id: this.id,
            displayName: this.displayName,
            officialUrl: SITE,
            attribution: "Titles and chapters are provided by ComicK. Please support the creators.",
            capabilities: { search: true, details: true, chapters: true, pages: true, types: ["manga", "manhwa", "manhua"], languages: null },
            notes: [
                "Catalog search and chapter requests use ComicK's api.comick.dev host with automatic fallback.",
                "If ComicK challenges the title-details route with Cloudflare, ComicVerse falls back to search or chapter metadata so title review and chapter approval can continue.",
                "Chapter page URLs are returned directly from ComicK or resolved from partner sources when ComicK omits hosted images.",
            ],
        };
    }
    async fetchWithGotScraping(targetUrl, referer, proxyUrl) {
        const gotScraping = await loadGotScraping();
        if (!gotScraping)
            return null;
        try {
            const origin = new URL(referer).origin;
            const res = await gotScraping({
                url: targetUrl,
                headerGeneratorOptions: {
                    browsers: [{ name: "chrome", minVersion: 120 }],
                    operatingSystems: ["windows"],
                    locales: ["en-US", "en"],
                },
                headers: {
                    Accept: "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                    Origin: origin,
                    Referer: referer,
                },
                ...(proxyUrl ? { proxyUrl } : {}),
                retry: { limit: 0 },
                timeout: { request: Math.min(this.config.timeoutMs, 8_000) },
                followRedirect: true,
                throwHttpErrors: false,
            });
            const responseHeaders = new Headers();
            for (const [k, v] of Object.entries(res.headers ?? {})) {
                if (typeof v === "string")
                    responseHeaders.set(k, v);
                else if (Array.isArray(v) && v.length)
                    responseHeaders.set(k, v.join(", "));
            }
            return new Response(res.body, {
                status: res.statusCode,
                statusText: res.statusMessage ?? "",
                headers: responseHeaders,
            });
        }
        catch {
            return null;
        }
    }
    async fetchWithFlareSolverr(targetUrl) {
        const flareSolverrUrl = process.env.FLARESOLVERR_URL?.trim();
        if (!flareSolverrUrl)
            return null;
        try {
            const res = await this.doFetch(`${flareSolverrUrl.replace(/\/+$/, "")}/v1`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cmd: "request.get", url: targetUrl, maxTimeout: 45_000 }),
                signal: AbortSignal.timeout(50_000),
            });
            const json = (await res.json());
            if (json?.status !== "ok" || !json.solution)
                return null;
            const rawBody = json.solution.response ?? "";
            const preMatch = rawBody.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
            const cleanBody = preMatch ? preMatch[1] : rawBody;
            return new Response(cleanBody, { status: json.solution.status ?? 200 });
        }
        catch {
            return null;
        }
    }
    buildCandidateUrls(originalUrl) {
        if (this.customFetch) {
            return [{ url: originalUrl, referer: "https://comick.dev/", useBrowserHeaders: false }];
        }
        const parsed = new URL(originalUrl);
        const pathAndQuery = `${parsed.pathname}${parsed.search}`;
        const candidates = [
            { url: originalUrl, referer: "https://comick.dev/", useBrowserHeaders: false },
            { url: originalUrl, referer: "https://comick.dev/", useBrowserHeaders: true },
        ];
        const customProxy = process.env.COMICK_API_PROXY_URL?.trim();
        if (customProxy) {
            candidates.push({
                url: `${customProxy.replace(/\/+$/, "")}${pathAndQuery}`,
                referer: "https://comick.dev/",
                useBrowserHeaders: true,
            });
        }
        candidates.push({
            url: `${PUBLIC_PROXY_API}${pathAndQuery}`,
            referer: "https://comick-api-proxy.notaspider.dev/",
            useBrowserHeaders: true,
        });
        return candidates;
    }
    async performSingleFetch(url, referer, useBrowserHeaders) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
            const headers = useBrowserHeaders
                ? {
                    "User-Agent": BROWSER_UA,
                    Accept: "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                    Origin: new URL(referer).origin,
                    Referer: referer,
                }
                : {
                    "User-Agent": this.config.userAgent,
                    Accept: "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                    Referer: "https://comick.dev/",
                };
            return await this.doFetch(url, {
                headers,
                signal: controller.signal,
            });
        }
        catch (error) {
            const failure = error;
            if (controller.signal.aborted || failure?.name === "AbortError") {
                throw new provider_interface_1.SourceError("SOURCE_TIMEOUT", "ComicK took too long to respond. Check your connection and try again.");
            }
            const code = [failure?.code, failure?.cause?.code, failure?.cause?.cause?.code]
                .find((value) => typeof value === "string") ?? "";
            const networkHint = {
                ENOTFOUND: "DNS could not resolve api.comick.dev",
                EAI_AGAIN: "DNS lookup for api.comick.dev temporarily failed",
                ECONNREFUSED: "the connection to api.comick.dev was refused",
                ECONNRESET: "the connection to api.comick.dev was reset",
                ETIMEDOUT: "the connection to api.comick.dev timed out",
                CERT_HAS_EXPIRED: "the TLS certificate has expired",
                UNABLE_TO_VERIFY_LEAF_SIGNATURE: "the TLS certificate could not be verified",
            };
            const hint = networkHint[code];
            throw new provider_interface_1.SourceError("SOURCE_UNAVAILABLE", hint
                ? `ComicK is unreachable from this PC: ${hint} (${code}).`
                : `ComicK is unreachable from this PC${code ? ` (${code})` : ""}. Check internet access, DNS and firewall settings.`);
        }
        finally {
            clearTimeout(timer);
        }
    }
    parseOrThrowResponse(response, bodyText) {
        if (!response.ok) {
            const safeBody = bodyText
                .replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 180);
            const cfRay = response.headers.get("cf-ray");
            const server = response.headers.get("server");
            const edgeHint = isCloudflareBody(response.status, safeBody, response.headers)
                ? " ComicK's Cloudflare/security layer appears to have blocked this request."
                : "";
            const diagnostic = [
                `HTTP ${response.status} ${response.statusText || ""}`.trim(),
                server ? `server=${server}` : "",
                cfRay ? `cf-ray=${cfRay}` : "",
                safeBody ? `response=${safeBody}` : "",
            ].filter(Boolean).join("; ");
            if (response.status === 404)
                throw new provider_interface_1.SourceError("NOT_FOUND", "That title or chapter was not found on ComicK.");
            if (response.status === 429) {
                const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
                throw new provider_interface_1.SourceError("SOURCE_RATE_LIMITED", `ComicK rate-limited this PC (${diagnostic}). Wait before trying again.`, Number.isFinite(retryAfter) ? retryAfter : undefined);
            }
            if (response.status === 400 || response.status === 422)
                throw new provider_interface_1.SourceError("INVALID_REQUEST", `ComicK rejected the request (${diagnostic}).`);
            if (response.status === 401)
                throw new provider_interface_1.SourceError("SOURCE_UNAVAILABLE", `ComicK returned HTTP 401 Unauthorized (${diagnostic}). Public catalog requests should not need a Comick login; verify the API URL and inspect the upstream response.`);
            if (response.status === 403)
                throw new provider_interface_1.SourceError("SOURCE_UNAVAILABLE", `ComicK returned HTTP 403 Forbidden (${diagnostic}).${edgeHint} This is an upstream access restriction, not a ComicVerse password error.`);
            throw new provider_interface_1.SourceError(response.status >= 500 ? "SOURCE_UNAVAILABLE" : "BAD_RESPONSE", `ComicK returned ${diagnostic || `HTTP ${response.status}`}.`);
        }
        try {
            return JSON.parse(bodyText);
        }
        catch {
            throw new provider_interface_1.SourceError("BAD_RESPONSE", "ComicK returned a successful HTTP status but the response was not valid JSON.");
        }
    }
    async requestJson(url) {
        if (this.customFetch) {
            const response = await this.performSingleFetch(url, "https://comick.dev/", false);
            const bodyText = await response.text();
            return this.parseOrThrowResponse(response, bodyText);
        }
        let firstError = null;
        const candidates = this.buildCandidateUrls(url);
        // 1. Try got-scraping against api.comick.dev first
        const gsResp = await this.fetchWithGotScraping(url, "https://comick.dev/");
        if (gsResp) {
            const bodyText = await gsResp.text();
            if (gsResp.ok && !isCloudflareBody(gsResp.status, bodyText, gsResp.headers)) {
                try {
                    return JSON.parse(bodyText);
                }
                catch {
                    // continue to fallback
                }
            }
        }
        // 2. If PROXY_URL is configured, try got-scraping via residential proxy
        const proxyUrl = process.env.PROXY_URL?.trim();
        if (proxyUrl) {
            const proxyResp = await this.fetchWithGotScraping(url, "https://comick.dev/", proxyUrl);
            if (proxyResp) {
                const bodyText = await proxyResp.text();
                if (proxyResp.ok && !isCloudflareBody(proxyResp.status, bodyText, proxyResp.headers)) {
                    try {
                        return JSON.parse(bodyText);
                    }
                    catch {
                        // continue
                    }
                }
            }
        }
        // 3. Try direct & proxy candidate URLs via fetch
        for (const candidate of candidates) {
            try {
                const response = await this.performSingleFetch(candidate.url, candidate.referer, candidate.useBrowserHeaders);
                const bodyText = await response.text();
                return this.parseOrThrowResponse(response, bodyText);
            }
            catch (error) {
                if (error instanceof provider_interface_1.SourceError) {
                    if (!firstError)
                        firstError = error;
                    if (error.code === "INVALID_REQUEST" || error.code === "NOT_FOUND")
                        throw error;
                    continue;
                }
                throw error;
            }
        }
        // 4. Try FlareSolverr if configured
        const fsResp = await this.fetchWithFlareSolverr(url);
        if (fsResp) {
            const bodyText = await fsResp.text();
            if (fsResp.ok) {
                try {
                    return JSON.parse(bodyText);
                }
                catch {
                    // fall through
                }
            }
        }
        throw firstError ?? new provider_interface_1.SourceError("SOURCE_UNAVAILABLE", "ComicK is currently unreachable.");
    }
    json(url) {
        const current = this.inFlight.get(url);
        if (current)
            return current;
        const pending = this.requestJson(url).finally(() => {
            if (this.inFlight.get(url) === pending)
                this.inFlight.delete(url);
        });
        this.inFlight.set(url, pending);
        return pending;
    }
    async health() {
        const started = Date.now();
        try {
            await this.json(this.searchUrl("comic", 1, 1));
            return { ok: true, latencyMs: Date.now() - started };
        }
        catch (error) {
            return { ok: false, latencyMs: Date.now() - started, message: error instanceof provider_interface_1.SourceError ? error.message : "Health check failed" };
        }
    }
    extractSlug(sourceUrl, externalId) {
        try {
            const pathname = new URL(sourceUrl).pathname;
            const slug = pathname.split("/").filter(Boolean).pop() ?? null;
            return slug && slug !== externalId ? slug : slug;
        }
        catch {
            return null;
        }
    }
    /**
     * Keep search metadata briefly so the review screen and approval flow can still
     * open and publish a title when Cloudflare challenges ComicK's /comic/{hid} endpoint.
     */
    rememberSearchResults(items) {
        const now = Date.now();
        for (const [id, cached] of this.searchSummaryCache) {
            if (cached.expiresAt <= now)
                this.searchSummaryCache.delete(id);
        }
        for (const item of items) {
            if (!item?.externalId || !ID.test(item.externalId))
                continue;
            const existing = this.searchSummaryCache.get(item.externalId);
            // Do not replace richer metadata already cached from a previous full detail response.
            if (existing && !existing.details.metadataFallback)
                continue;
            const slug = this.extractSlug(item.sourceUrl, item.externalId);
            if (slug)
                this.slugToHid.set(slug.toLowerCase(), item.externalId);
            const langs = item.availableLanguages?.length
                ? [...item.availableLanguages]
                : item.language
                    ? [item.language]
                    : ["en"];
            const details = {
                ...item,
                contentType: item.contentType === "unknown" ? "manga" : item.contentType,
                alternativeTitles: [...item.alternativeTitles],
                authors: [...(item.authors ?? [])],
                artists: [...(item.artists ?? [])],
                year: item.year ?? null,
                availableLanguages: langs,
                metadataFallback: "search",
            };
            this.searchSummaryCache.delete(item.externalId);
            this.searchSummaryCache.set(item.externalId, {
                details,
                slug,
                expiresAt: now + ComicKProvider.SUMMARY_TTL_MS,
            });
        }
        while (this.searchSummaryCache.size > ComicKProvider.SUMMARY_CACHE_MAX) {
            const oldest = this.searchSummaryCache.keys().next().value;
            if (!oldest)
                break;
            this.searchSummaryCache.delete(oldest);
        }
    }
    rememberDetails(details) {
        const slug = this.extractSlug(details.sourceUrl, details.externalId);
        if (slug)
            this.slugToHid.set(slug.toLowerCase(), details.externalId);
        this.searchSummaryCache.set(details.externalId, {
            details: {
                ...details,
                alternativeTitles: [...details.alternativeTitles],
                authors: [...details.authors],
                artists: [...details.artists],
                availableLanguages: details.availableLanguages.length ? [...details.availableLanguages] : ["en"],
            },
            slug,
            expiresAt: Date.now() + ComicKProvider.SUMMARY_TTL_MS,
        });
    }
    cachedSearchDetails(externalId) {
        const resolvedId = this.slugToHid.get(externalId.toLowerCase()) ?? externalId;
        const cached = this.searchSummaryCache.get(resolvedId) ?? this.searchSummaryCache.get(externalId);
        if (!cached)
            return null;
        if (cached.expiresAt <= Date.now()) {
            this.searchSummaryCache.delete(resolvedId);
            return null;
        }
        return {
            ...cached.details,
            alternativeTitles: [...cached.details.alternativeTitles],
            authors: [...cached.details.authors],
            artists: [...cached.details.artists],
            availableLanguages: [...cached.details.availableLanguages],
        };
    }
    isCloudflareChallenge(error) {
        return error instanceof provider_interface_1.SourceError
            && error.code === "SOURCE_UNAVAILABLE"
            && (/HTTP 403 Forbidden/i.test(error.message) || /Cloudflare\/security layer appears to have blocked/i.test(error.message));
    }
    searchUrl(query, page, limit, type, countryOverride) {
        const url = new URL("/v1.0/search", API);
        url.searchParams.set("q", query);
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        const country = countryOverride ?? (type ? COUNTRY[type] : undefined);
        if (country)
            url.searchParams.set("country", country);
        return url.toString();
    }
    async search(query) {
        if (query.type && !COUNTRY[query.type]) {
            throw new provider_interface_1.SourceError("INVALID_REQUEST", `ComicK does not support the "${query.type}" type.`);
        }
        const page = Math.max(query.page, 1);
        const limit = Math.min(Math.max(query.limit, 1), 100);
        if ((page - 1) * limit + limit > MAX_OFFSET)
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "Search only reaches the first 10,000 results. Try a more specific search.");
        const raw = await this.json(this.searchUrl(query.q, page, limit, query.type));
        let result = (0, comick_normalize_1.normalizeSearch)(raw, { ...query, page, limit });
        if (!this.customFetch && query.type === "manhua" && result.items.length === 0) {
            try {
                const cnRaw = await this.json(this.searchUrl(query.q, page, limit, query.type, "cn"));
                const cnResult = (0, comick_normalize_1.normalizeSearch)(cnRaw, { ...query, page, limit });
                if (cnResult.items.length > 0)
                    result = cnResult;
            }
            catch {
                // retain initial result
            }
        }
        this.rememberSearchResults(result.items);
        return result;
    }
    async recoverDetailsOnChallenge(externalId) {
        const cached = this.cachedSearchDetails(externalId);
        if (cached)
            return cached;
        if (this.customFetch)
            return null;
        // 1. Try /v1.0/comic/{externalId}
        try {
            const v1Raw = await this.json(new URL(`/v1.0/comic/${encodeURIComponent(externalId)}`, API).toString());
            const details = (0, comick_normalize_1.normalizeDetails)(v1Raw, externalId);
            this.rememberDetails(details);
            return details;
        }
        catch {
            // continue to search recovery
        }
        // 2. Try searching for the externalId to warm searchSummaryCache
        try {
            await this.search({ q: externalId, page: 1, limit: 20 });
            const fromIdSearch = this.cachedSearchDetails(externalId);
            if (fromIdSearch)
                return fromIdSearch;
        }
        catch {
            // continue
        }
        // 3. Try fetching the first chapter page to extract comic slug / metadata
        try {
            const chapterUrl = new URL(`/comic/${encodeURIComponent(externalId)}/chapters`, API);
            chapterUrl.searchParams.set("page", "1");
            chapterUrl.searchParams.set("limit", "20");
            chapterUrl.searchParams.set("lang", "en");
            const rawChapters = await this.json(chapterUrl.toString());
            const normalized = (0, comick_normalize_1.normalizeChapters)(rawChapters, externalId, "en", 1, 20);
            this.rememberChapters(externalId, "en", 1, normalized);
            const firstSourceUrl = normalized.items[0]?.sourceUrl ?? `${SITE}/comic/${encodeURIComponent(externalId)}`;
            const slug = this.extractSlug(firstSourceUrl, externalId);
            if (slug && slug !== externalId) {
                const queryWords = slug.replace(/[-_]+/g, " ").trim();
                if (queryWords) {
                    try {
                        await this.search({ q: queryWords, page: 1, limit: 20 });
                        const fromSlugSearch = this.cachedSearchDetails(externalId);
                        if (fromSlugSearch)
                            return fromSlugSearch;
                    }
                    catch {
                        // continue to synthesized fallback
                    }
                }
            }
            const readableTitle = slug && slug !== externalId
                ? slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
                : `ComicK Title (${externalId})`;
            const synthesized = {
                id: externalId,
                externalId,
                sourceId: "comick",
                title: readableTitle,
                alternativeTitles: [],
                coverUrl: null,
                description: null,
                status: "ongoing",
                genres: [],
                contentType: "manga",
                language: "en",
                sourceUrl: firstSourceUrl,
                authors: [],
                artists: [],
                year: null,
                availableLanguages: ["en"],
                metadataFallback: "search",
            };
            this.rememberSearchResults([synthesized]);
            return synthesized;
        }
        catch {
            return null;
        }
    }
    async details(externalId) {
        if (!ID.test(externalId))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That title id is not valid.");
        if (Date.now() < this.detailsCloudflareBlockedUntil) {
            const cached = this.cachedSearchDetails(externalId);
            if (cached)
                return cached;
        }
        try {
            const raw = await this.json(new URL(`/comic/${encodeURIComponent(externalId)}`, API).toString());
            const details = (0, comick_normalize_1.normalizeDetails)(raw, externalId);
            this.rememberDetails(details);
            return details;
        }
        catch (error) {
            if (this.isCloudflareChallenge(error)) {
                this.detailsCloudflareBlockedUntil = Date.now() + 5 * 60 * 1000;
                const recovered = await this.recoverDetailsOnChallenge(externalId);
                if (recovered)
                    return recovered;
            }
            else if (!this.customFetch && error instanceof provider_interface_1.SourceError && (error.code === "NOT_FOUND" || error.code === "SOURCE_UNAVAILABLE")) {
                const recovered = await this.recoverDetailsOnChallenge(externalId);
                if (recovered)
                    return recovered;
            }
            throw error;
        }
    }
    chapterCacheKey(externalId, language, page) {
        return `${externalId}:${language.toLowerCase()}:${page}`;
    }
    rememberChapters(externalId, language, page, response) {
        const now = Date.now();
        for (const [k, v] of this.chapterCache) {
            if (v.expiresAt <= now)
                this.chapterCache.delete(k);
        }
        this.chapterCache.set(this.chapterCacheKey(externalId, language, page), {
            response,
            expiresAt: now + ComicKProvider.SUMMARY_TTL_MS,
        });
    }
    cachedChapters(externalId, language, page) {
        const entry = this.chapterCache.get(this.chapterCacheKey(externalId, language, page));
        if (!entry)
            return null;
        if (entry.expiresAt <= Date.now()) {
            this.chapterCache.delete(this.chapterCacheKey(externalId, language, page));
            return null;
        }
        return entry.response;
    }
    async chapters(externalId, options) {
        if (!ID.test(externalId))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That title id is not valid.");
        if (!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(options.language))
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That chapter language is not valid.");
        const page = Math.max(options.page, 1);
        const limit = Math.min(Math.max(options.limit, 1), 20);
        if ((page - 1) * limit + limit > MAX_OFFSET)
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "Chapter pagination is limited to the first 10,000 results.");
        const lang = options.language.toLowerCase();
        const url = new URL(`/comic/${encodeURIComponent(externalId)}/chapters`, API);
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("lang", lang);
        try {
            const raw = await this.json(url.toString());
            let result = (0, comick_normalize_1.normalizeChapters)(raw, externalId, options.language, page, limit);
            if (!this.customFetch && result.items.length === 0 && page === 1 && lang === "en") {
                try {
                    const gbUrl = new URL(`/comic/${encodeURIComponent(externalId)}/chapters`, API);
                    gbUrl.searchParams.set("page", "1");
                    gbUrl.searchParams.set("limit", String(limit));
                    gbUrl.searchParams.set("lang", "gb");
                    const gbRaw = await this.json(gbUrl.toString());
                    const gbResult = (0, comick_normalize_1.normalizeChapters)(gbRaw, externalId, "en", 1, limit);
                    if (gbResult.items.length > 0)
                        result = gbResult;
                }
                catch {
                    // ignore fallback error
                }
            }
            this.rememberChapters(externalId, lang, page, result);
            return result;
        }
        catch (error) {
            if (!this.customFetch) {
                try {
                    const v1Url = new URL(`/v1.0/comic/${encodeURIComponent(externalId)}/chapters`, API);
                    v1Url.searchParams.set("page", String(page));
                    v1Url.searchParams.set("limit", String(limit));
                    v1Url.searchParams.set("lang", lang);
                    const v1Raw = await this.json(v1Url.toString());
                    const result = (0, comick_normalize_1.normalizeChapters)(v1Raw, externalId, options.language, page, limit);
                    this.rememberChapters(externalId, lang, page, result);
                    return result;
                }
                catch {
                    // check cached chapters next
                }
                const cached = this.cachedChapters(externalId, lang, page);
                if (cached)
                    return cached;
            }
            throw error;
        }
    }
    async pages(chapterId, options, mangaId) {
        void options;
        if (!ID.test(chapterId) || (mangaId !== undefined && !ID.test(mangaId))) {
            throw new provider_interface_1.SourceError("INVALID_REQUEST", "That chapter or title id is not valid.");
        }
        const url = new URL(`/chapter/${encodeURIComponent(chapterId)}`, API);
        const raw = await this.json(url.toString());
        return (0, comick_normalize_1.normalizePages)(raw, chapterId, mangaId);
    }
}
exports.ComicKProvider = ComicKProvider;
