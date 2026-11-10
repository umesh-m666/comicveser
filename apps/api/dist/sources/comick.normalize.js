"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLanguageCode = normalizeLanguageCode;
exports.normalizeContentType = normalizeContentType;
exports.normalizeSearch = normalizeSearch;
exports.normalizeChapters = normalizeChapters;
exports.normalizePages = normalizePages;
exports.normalizeDetails = normalizeDetails;
const provider_interface_1 = require("./provider.interface");
const COMICK_WEB = "https://comick.dev";
const COMICK_PICTURES = "https://meo.comick.pictures";
function obj(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function str(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function num(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function numberOrString(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    return str(value);
}
function cleanText(value) {
    const raw = str(value);
    if (!raw)
        return null;
    const text = raw
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
    return text || null;
}
function normalizeLanguageCode(code) {
    const clean = code.trim().toLowerCase();
    if (clean === "gb" || clean === "en-gb" || clean === "en-us")
        return "en";
    return clean;
}
function normalizeContentType(country) {
    const code = str(country)?.toLowerCase();
    if (code === "jp" || code === "ja")
        return "manga";
    if (code === "kr" || code === "ko")
        return "manhwa";
    if (code === "cn" || code === "zh" || code === "zh-hk" || code === "tw" || code === "hk")
        return "manhua";
    return "unknown";
}
function normalizeStatus(status) {
    if (status === 1 || status === "1" || str(status)?.toLowerCase() === "ongoing")
        return "ongoing";
    if (status === 2 || status === "2" || str(status)?.toLowerCase() === "completed")
        return "completed";
    if (status === 3 || status === "3" || str(status)?.toLowerCase() === "cancelled")
        return "cancelled";
    if (status === 4 || status === "4" || str(status)?.toLowerCase() === "hiatus")
        return "hiatus";
    return null;
}
function isAllowedComickImageHost(hostname) {
    const host = hostname.toLowerCase();
    return host === "meo.comick.pictures" || /^meo\d*\.comick\.pictures$/.test(host) || host.endsWith(".comick.pictures");
}
function imageFrom(value) {
    if (typeof value === "string") {
        const direct = str(value);
        if (!direct)
            return null;
        if (/^https?:\/\//i.test(direct)) {
            try {
                const parsed = new URL(direct);
                return parsed.protocol === "https:" && isAllowedComickImageHost(parsed.hostname) ? parsed.toString() : null;
            }
            catch {
                return null;
            }
        }
        const cleanKey = direct.replace(/^\/+/, "");
        if (!cleanKey || cleanKey.includes("..") || cleanKey.includes("?") || cleanKey.includes("#"))
            return null;
        return `${COMICK_PICTURES}/${cleanKey}`;
    }
    const row = obj(value);
    const direct = str(row.url) ?? str(row.src) ?? str(row.gpurl);
    if (direct && /^https?:\/\//i.test(direct)) {
        try {
            const parsed = new URL(direct);
            return parsed.protocol === "https:" && isAllowedComickImageHost(parsed.hostname) ? parsed.toString() : null;
        }
        catch {
            return null;
        }
    }
    const key = str(row.b2key) ?? str(row.key) ?? str(row.filename) ?? str(row.name);
    if (!key)
        return null;
    if (/^https?:\/\//i.test(key)) {
        try {
            const parsed = new URL(key);
            return parsed.protocol === "https:" && isAllowedComickImageHost(parsed.hostname) ? parsed.toString() : null;
        }
        catch {
            return null;
        }
    }
    const cleanKey = key.replace(/^\/+/, "");
    if (!cleanKey || cleanKey.includes("..") || cleanKey.includes("?") || cleanKey.includes("#"))
        return null;
    return `${COMICK_PICTURES}/${cleanKey}`;
}
function titlesFrom(row, primaryTitle) {
    const values = [
        ...list(row.md_titles).map((entry) => str(obj(entry).title) ?? str(entry)),
        ...list(row.alt_titles).map((entry) => str(obj(entry).title) ?? str(entry)),
        ...list(row.titles).map((entry) => str(obj(entry).title) ?? str(entry)),
    ];
    const seen = new Set([primaryTitle.toLowerCase()]);
    return values.filter((title) => {
        if (!title)
            return false;
        const key = title.toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function names(value) {
    const items = list(value)
        .map((entry) => {
        const record = obj(entry);
        return str(entry) ?? str(record.name) ?? str(record.title) ?? str(obj(record.md_artists).name) ?? str(obj(record.md_authors).name);
    })
        .filter((entry) => !!entry);
    return [...new Set(items)];
}
function genresFrom(row) {
    const items = [
        ...list(row.genres),
        ...list(row.md_comic_md_genres).map((entry) => obj(entry).md_genres ?? entry),
    ]
        .map((entry) => str(entry) ?? str(obj(entry).name) ?? str(obj(entry).slug))
        .filter((entry) => !!entry);
    return [...new Set(items)];
}
function sourceUrl(externalId, slug) {
    const path = str(slug) ?? externalId;
    return `${COMICK_WEB}/comic/${encodeURIComponent(path)}`;
}
function stringList(value) {
    return list(value)
        .map((entry) => str(entry) ?? str(obj(entry).lang) ?? str(obj(entry).code))
        .filter((entry) => !!entry);
}
function year(value) {
    const parsed = num(value);
    return parsed !== null && Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null;
}
function normalizeSummary(raw) {
    const row = obj(raw);
    const externalId = str(row.hid) ?? str(row.slug) ?? numberOrString(row.id);
    const title = str(row.title) ?? str(row.name);
    if (!externalId || !title)
        return null;
    const cover = list(row.md_covers).map(imageFrom).find((url) => !!url)
        ?? imageFrom(row.cover_url)
        ?? imageFrom(row.cover)
        ?? imageFrom(row.default_thumbnail);
    const authors = names(row.author ?? row.authors ?? row.md_comic_md_authors);
    const artists = names(row.artist ?? row.artists ?? row.md_comic_md_artists);
    const availableLanguages = [...new Set(stringList(row.lang_list ?? row.langList)
            .map(normalizeLanguageCode)
            .filter((language) => /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(language)))];
    const rawLang = str(row.iso639_1) ?? str(row.lang);
    return {
        id: externalId,
        externalId,
        sourceId: "comick",
        title,
        alternativeTitles: titlesFrom(row, title),
        coverUrl: cover,
        description: cleanText(row.desc ?? row.description ?? row.parsed),
        status: normalizeStatus(row.status),
        genres: genresFrom(row),
        contentType: normalizeContentType(row.country ?? row.origination ?? row.type),
        language: rawLang ? normalizeLanguageCode(rawLang) : null,
        sourceUrl: sourceUrl(externalId, row.slug),
        ...(authors.length ? { authors } : {}),
        ...(artists.length ? { artists } : {}),
        ...(year(row.year) !== null ? { year: year(row.year) } : {}),
        ...(availableLanguages.length ? { availableLanguages } : {}),
    };
}
function normalizeSearch(raw, query) {
    const body = obj(raw);
    const rawList = Array.isArray(raw)
        ? raw
        : Array.isArray(body.data)
            ? body.data
            : Array.isArray(body.comics)
                ? body.comics
                : Array.isArray(body.rank)
                    ? body.rank
                    : null;
    if (!rawList)
        throw new provider_interface_1.SourceError("BAD_RESPONSE", "ComicK sent a search response we could not read.");
    const seen = new Set();
    const filtered = rawList
        .map(normalizeSummary)
        .filter((item) => {
        if (!item || seen.has(item.externalId))
            return false;
        if (query.type && query.type !== "unknown" && item.contentType !== "unknown" && item.contentType !== query.type)
            return false;
        seen.add(item.externalId);
        return true;
    });
    const totalFromBody = num(body.total ?? body.count);
    // ComicK search returns one page per upstream request unless the caller got a
    // full unpaged array that actually exceeds `query.limit`. Do not slice by
    // `(page - 1) * limit` when `rawList.length <= query.limit`, otherwise page 2+
    // gets emptied out.
    const isUnpagedFullList = rawList.length > query.limit;
    const start = isUnpagedFullList ? (query.page - 1) * query.limit : 0;
    const items = isUnpagedFullList ? filtered.slice(start, start + query.limit) : filtered.slice(0, query.limit);
    const hasMore = totalFromBody !== null
        ? (query.page - 1) * query.limit + items.length < totalFromBody
        : isUnpagedFullList
            ? start + query.limit < filtered.length
            : rawList.length >= query.limit;
    const total = totalFromBody !== null
        ? totalFromBody
        : isUnpagedFullList
            ? filtered.length
            : (query.page - 1) * query.limit + items.length + (hasMore ? 1 : 0);
    return {
        items,
        total,
        totalExact: totalFromBody !== null || isUnpagedFullList || !hasMore,
        page: query.page,
        limit: query.limit,
        hasMore,
    };
}
function chapterGroups(row) {
    const groups = [
        ...list(row.group_name).map(str),
        ...list(row.md_chapters_groups).map((entry) => str(obj(obj(entry).md_groups).title) ?? str(obj(entry).title)),
        ...list(row.groups).map((entry) => str(obj(entry).name) ?? str(obj(entry).title) ?? str(entry)),
    ].filter((name) => !!name);
    return [...new Set(groups)];
}
function normalizeChapters(raw, externalId, requestedLanguage, page, limit) {
    const body = obj(raw);
    const chapterList = Array.isArray(raw)
        ? raw
        : Array.isArray(body.chapters)
            ? body.chapters
            : Array.isArray(body.data)
                ? body.data
                : null;
    if (!chapterList)
        throw new provider_interface_1.SourceError("BAD_RESPONSE", "ComicK sent a chapter list we could not read.");
    const normalizedTargetLang = normalizeLanguageCode(requestedLanguage || "en");
    const seenIds = new Set();
    const all = chapterList
        .map((entry) => {
        const row = obj(entry);
        const id = str(row.hid) ?? numberOrString(row.id);
        if (!id || seenIds.has(id))
            return null;
        const rawLanguage = str(row.lang) ?? str(row.iso639_1);
        const language = rawLanguage ? normalizeLanguageCode(rawLanguage) : normalizedTargetLang;
        if (normalizedTargetLang && language && language.toLowerCase() !== normalizedTargetLang.toLowerCase())
            return null;
        seenIds.add(id);
        const numberLabel = numberOrString(row.chap ?? row.chapter);
        return {
            id,
            sourceId: "comick",
            mangaId: externalId,
            number: num(numberLabel),
            numberLabel,
            title: str(row.title),
            volume: numberOrString(row.vol ?? row.volume),
            language,
            publishedAt: str(row.created_at ?? row.publish_at ?? row.updated_at),
            groups: chapterGroups(row),
            pageCount: num(row.ImageCount ?? row.images_count ?? row.page_count),
            sourceUrl: `${COMICK_WEB}/comic/${encodeURIComponent(externalId)}/${encodeURIComponent(id)}`,
            duplicateNumber: false,
        };
    })
        .filter((item) => !!item);
    const total = num(body.total ?? body.count);
    const numberCounts = new Map();
    for (const item of all)
        if (item.numberLabel)
            numberCounts.set(item.numberLabel, (numberCounts.get(item.numberLabel) ?? 0) + 1);
    for (const item of all)
        item.duplicateNumber = !!item.numberLabel && (numberCounts.get(item.numberLabel) ?? 0) > 1;
    // The ComicK endpoint already applies the requested page and limit. Do not
    // slice by page a second time: that would discard every row on page 2+.
    const items = all;
    const hasMore = total === null ? chapterList.length >= limit : (page - 1) * limit + items.length < total;
    return { items, total: total ?? (page - 1) * limit + items.length, totalExact: total !== null, page, limit, hasMore };
}
function comicIdFrom(value) {
    if (Array.isArray(value)) {
        for (const item of value) {
            const id = comicIdFrom(item);
            if (id)
                return id;
        }
        return null;
    }
    const row = obj(value);
    return str(row.hid) ?? str(obj(row.md_comic).hid) ?? null;
}
function normalizePages(raw, chapterId, mangaId) {
    const body = obj(raw);
    const chapter = Object.keys(obj(body.chapter)).length ? obj(body.chapter) : body;
    const returnedChapterId = str(chapter.hid);
    if (returnedChapterId && returnedChapterId !== chapterId)
        throw new provider_interface_1.SourceError("NOT_FOUND", "That ComicK chapter was not found.");
    const returnedMangaId = comicIdFrom(chapter.md_comics ?? chapter.comic ?? chapter.md_comic);
    const returnedSlug = str(chapter.comic_slug) ?? str(obj(chapter.md_comics).slug) ?? str(obj(chapter.comic).slug);
    if (mangaId && returnedMangaId && returnedMangaId !== mangaId && returnedSlug !== mangaId) {
        throw new provider_interface_1.SourceError("NOT_FOUND", "That ComicK chapter was not found.");
    }
    const rawImages = Array.isArray(raw)
        ? raw
        : chapter.md_images ?? body.md_images ?? chapter.images ?? body.images;
    const hasChapterMetadata = numberOrString(chapter.chap ?? chapter.chapter) !== null ||
        returnedMangaId !== null ||
        str(chapter.created_at) !== null ||
        str(chapter.lang) !== null;
    if (!Array.isArray(rawImages) && !hasChapterMetadata) {
        throw new provider_interface_1.SourceError("BAD_RESPONSE", "ComicK sent a response we could not read.");
    }
    const images = Array.isArray(rawImages) ? rawImages : [];
    const seen = new Set();
    const pages = images.flatMap((image) => {
        const imageUrl = imageFrom(image);
        if (!imageUrl || seen.has(imageUrl))
            return [];
        seen.add(imageUrl);
        const row = obj(image);
        const positiveDimension = (value) => typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
        return [{ pageNumber: seen.size, imageUrl, width: positiveDimension(row.w ?? row.width), height: positiveDimension(row.h ?? row.height) }];
    });
    const rawLang = str(chapter.lang);
    return {
        sourceId: "comick",
        mangaId: mangaId ?? returnedMangaId,
        chapterId,
        chapterTitle: str(chapter.title),
        chapterNumber: numberOrString(chapter.chap ?? chapter.chapter),
        language: rawLang ? normalizeLanguageCode(rawLang) : null,
        pages,
        groups: chapterGroups(chapter),
        sourceUrl: sourceUrl(mangaId ?? returnedMangaId ?? chapterId, chapter.comic_slug ?? obj(chapter.md_comics).slug),
    };
}
function normalizeDetails(raw, externalId) {
    const body = obj(raw);
    const comic = Object.keys(obj(body.comic)).length ? obj(body.comic) : body;
    const summary = normalizeSummary(comic);
    const slug = str(comic.slug);
    if (!summary || (summary.externalId !== externalId && slug !== externalId)) {
        throw new provider_interface_1.SourceError("BAD_RESPONSE", "ComicK returned title details we could not read.");
    }
    const resolvedId = summary.externalId;
    const alternativeTitles = titlesFrom(comic, summary.title);
    const cover = list(comic.md_covers).map(imageFrom).find((url) => !!url)
        ?? imageFrom(comic.cover_url)
        ?? imageFrom(comic.cover)
        ?? imageFrom(comic.default_thumbnail);
    const rawLanguages = [
        ...stringList(comic.lang_list),
        ...stringList(body.langList),
    ]
        .map(normalizeLanguageCode)
        .filter((language) => /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(language));
    const availableLanguages = rawLanguages.length
        ? [...new Set(rawLanguages)]
        : (summary.availableLanguages && summary.availableLanguages.length ? [...summary.availableLanguages] : ["en"]);
    return {
        ...summary,
        id: resolvedId,
        externalId: resolvedId,
        alternativeTitles,
        coverUrl: cover,
        authors: names(comic.author ?? comic.authors ?? body.authors ?? comic.md_comic_md_authors),
        artists: names(comic.artist ?? comic.artists ?? body.artists ?? comic.md_comic_md_artists),
        year: year(comic.year),
        availableLanguages,
    };
}
