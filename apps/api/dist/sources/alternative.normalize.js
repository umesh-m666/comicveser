"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALTERNATIVE_PROVIDER_IDS = void 0;
exports.normalizeMatchText = normalizeMatchText;
exports.titlesRoughlyMatch = titlesRoughlyMatch;
exports.chapterNumbersMatch = chapterNumbersMatch;
exports.buildSourceReaderUrl = buildSourceReaderUrl;
exports.findMatchingSummary = findMatchingSummary;
exports.buildAlternativeSourceMatch = buildAlternativeSourceMatch;
exports.ALTERNATIVE_PROVIDER_IDS = ["weebcentral", "asurascans"];
function normalizeMatchText(value) {
    return value
        .toLowerCase()
        .replace(/^official\s+/i, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}
function titlesRoughlyMatch(a, b) {
    const na = normalizeMatchText(a);
    const nb = normalizeMatchText(b);
    if (!na || !nb)
        return false;
    if (na === nb)
        return true;
    if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na)))
        return true;
    const tokensA = na.split(" ").filter((t) => t.length > 1);
    const tokensB = new Set(nb.split(" ").filter((t) => t.length > 1));
    if (tokensA.length < 2 || tokensB.size < 2)
        return false;
    const overlap = tokensA.filter((t) => tokensB.has(t)).length;
    return overlap / Math.max(tokensA.length, tokensB.size) >= 0.75;
}
function chapterNumbersMatch(candidateLabel, candidateNum, targetLabel, targetNum) {
    if (candidateLabel && targetLabel && candidateLabel.trim() === targetLabel.trim())
        return true;
    if (targetNum !== null && !Number.isNaN(targetNum) && candidateNum !== null && !Number.isNaN(candidateNum)) {
        return Math.abs(candidateNum - targetNum) < 0.001;
    }
    return false;
}
function buildSourceReaderUrl(sourceId, externalId, chapterId, language) {
    const lang = language || "en";
    return `/sources/${encodeURIComponent(sourceId)}/${encodeURIComponent(externalId)}/read/${encodeURIComponent(chapterId)}?lang=${encodeURIComponent(lang)}`;
}
function findMatchingSummary(items, candidateTitles) {
    const cleanTitles = candidateTitles.map((t) => t?.trim() ?? "").filter(Boolean);
    if (!cleanTitles.length)
        return undefined;
    return items.find((item) => [item.title, ...item.alternativeTitles].some((candidate) => cleanTitles.some((target) => titlesRoughlyMatch(candidate, target))));
}
/**
 * Builds an AlternativeSourceMatch from a matched WeebCentral or Asura Scans manga
 * and its chapter list, strictly preserving the alternative provider's own sourceId,
 * externalId (mangaId), chapter IDs, source URLs, and ComicVerse reader URLs.
 */
function buildAlternativeSourceMatch(altSourceId, sourceName, matchedItem, chRes, language = "en", targetLabel = null, targetNum = null) {
    const chapters = chRes.items.map((ch) => ({
        ...ch,
        id: ch.id,
        sourceId: altSourceId,
        mangaId: matchedItem.externalId,
        sourceUrl: ch.sourceUrl,
        readerUrl: buildSourceReaderUrl(altSourceId, matchedItem.externalId, ch.id, ch.language ?? language),
    }));
    const matchedChapter = targetLabel !== null || targetNum !== null
        ? chapters.find((ch) => chapterNumbersMatch(ch.numberLabel, ch.number, targetLabel, targetNum)) ?? null
        : null;
    return {
        sourceId: altSourceId,
        sourceName,
        externalId: matchedItem.externalId,
        title: matchedItem.title,
        coverUrl: matchedItem.coverUrl,
        sourceUrl: matchedItem.sourceUrl,
        catalogUrl: `/sources/${encodeURIComponent(altSourceId)}/${encodeURIComponent(matchedItem.externalId)}`,
        adminReviewUrl: `/admin/comics/new/${encodeURIComponent(altSourceId)}/${encodeURIComponent(matchedItem.externalId)}`,
        totalChapters: chRes.total,
        chapters,
        matchedChapter,
    };
}
