import { BadRequestException, ConflictException, HttpException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ComicStatus, ComicType, Prisma, SourceTitleState } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../common/util";
import { SourceError } from "./provider.interface";
import type {
  AlternativeChapterItem,
  AlternativeSourceMatch,
  ChapterItem,
  ChaptersResponse,
  ContentType,
  MangaDetails,
  MangaSourceProvider,
  SearchQuery,
} from "./provider.interface";
import type { SourcesConfig } from "./sources.config";

export const SOURCES_CONFIG = Symbol("SOURCES_CONFIG");
export const SOURCE_PROVIDERS = Symbol("SOURCE_PROVIDERS");

interface ErrorEntry { at: string; sourceId: string; code: string; message: string }
const TTL = { search: 300, details: 600, chapters: 300 }; // seconds. Page image URLs are temporary, so they are never cached.
const RECORDED = new Set(["SOURCE_UNAVAILABLE", "SOURCE_TIMEOUT", "SOURCE_RATE_LIMITED", "BAD_RESPONSE"]);
const MAX_SOURCE_OFFSET = 10_000;
const DEFAULT_CHAPTER_LIMIT = 500;
import {
  ALTERNATIVE_PROVIDER_IDS,
  buildAlternativeSourceMatch,
  chapterNumbersMatch,
  findMatchingSummary,
} from "./alternative.normalize";

const CONTENT_TYPES: Record<string, ComicType> = { manga: "MANGA", manhwa: "MANHWA", manhua: "MANHUA" };

function safeDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function chapterTitle(c: ChapterItem) {
  const label = c.numberLabel ? `Chapter ${c.numberLabel}` : "Special chapter";
  return c.title ? `${label}: ${c.title}`.slice(0, 300) : label;
}

@Injectable()
export class SourcesService {
  private log = new Logger("Sources");
  private providers = new Map<string, MangaSourceProvider>();
  private errors: ErrorEntry[] = [];

  constructor(
    private db: PrismaService, private cache: CacheService,
    @Inject(SOURCES_CONFIG) private cfg: SourcesConfig, @Inject(SOURCE_PROVIDERS) providers: MangaSourceProvider[],
  ) { for (const p of providers) this.providers.set(p.id, p); }

  private record(sourceId: string, e: SourceError) {
    this.errors.push({ at: new Date().toISOString(), sourceId, code: e.code, message: e.message });
    if (this.errors.length > 50) this.errors.shift();
    this.log.warn(`${sourceId}: ${e.code}: ${e.message}`);
  }

  /** Throws unless external sources are on, the source exists, and an admin hasn't disabled it. */
  private async available(sourceId: string): Promise<MangaSourceProvider> {
    if (!this.cfg.enabled) throw new HttpException("External sources are turned off on this server.", 503);
    const p = this.providers.get(sourceId);
    if (!p) throw new NotFoundException("Unknown source.");
    const s = await this.db.sourceSetting.findUnique({ where: { sourceId } });
    if (s && !s.enabled) throw new HttpException("This source has been disabled by an administrator.", 503);
    return p;
  }

  private async run<T>(sourceId: string, fn: (p: MangaSourceProvider) => Promise<T>): Promise<T> {
    const p = await this.available(sourceId);
    try { return await fn(p); }
    catch (e) {
      if (e instanceof HttpException) throw e;
      if (e instanceof SourceError) { if (RECORDED.has(e.code)) this.record(sourceId, e); throw new HttpException(e.message, e.status); }
      this.log.error(`Unexpected error from ${sourceId}: ${(e as Error)?.message}`);
      throw new HttpException("The source returned something unexpected.", 502);
    }
  }

  private async settings() { return new Map((await this.db.sourceSetting.findMany()).map((s) => [s.sourceId, s])); }
  private invalidateComicCaches() { return Promise.all(["comics:trending", "comics:popular", "comics:latest"].map((key) => this.cache.delete(key))); }

  private async publishedTitle(sourceId: string, externalId: string) {
    const row = await this.db.sourceTitle.findFirst({
      where: {
        sourceId,
        externalId,
        state: "APPROVED",
        OR: [
          { comic: { publishState: "PUBLISHED", deletedAt: null } },
          { comicId: null },
          { chapters: { some: { chapter: { publishState: "PUBLISHED", deletedAt: null, comic: { publishState: "PUBLISHED", deletedAt: null } } } } },
        ],
      },
      include: { comic: { select: { id: true, slug: true, title: true, altTitle: true, publishState: true } } },
    });
    if (!row) throw new NotFoundException("Title not found.");
    return row;
  }

  private async ensureApprovedAlternativeSourceTitle(alt: {
    sourceId: string;
    externalId: string;
    title: string;
    sourceUrl: string;
    coverUrl: string | null;
    contentType?: string;
  }) {
    const contentType = alt.contentType && ["manga", "manhwa", "manhua"].includes(alt.contentType)
      ? alt.contentType
      : "manga";
    return this.db.sourceTitle.upsert({
      where: { sourceId_externalId: { sourceId: alt.sourceId, externalId: alt.externalId } },
      update: {
        title: alt.title,
        sourceUrl: alt.sourceUrl,
        coverUrl: alt.coverUrl,
        state: "APPROVED",
      },
      create: {
        sourceId: alt.sourceId,
        externalId: alt.externalId,
        title: alt.title,
        sourceUrl: alt.sourceUrl,
        coverUrl: alt.coverUrl,
        contentType,
        state: "APPROVED",
      },
    });
  }

  async findAlternativeSources(
    candidateTitles: string[],
    language = "en",
    targetLabel: string | null = null,
    targetNum: number | null = null,
  ): Promise<AlternativeSourceMatch[]> {
    const cleanTitles = [...new Set(candidateTitles.map((t) => t?.trim() ?? "").filter(Boolean))];
    if (!cleanTitles.length || !this.cfg.enabled) return [];

    const settings = await this.settings();
    const results = await Promise.all(
      ALTERNATIVE_PROVIDER_IDS.map(async (altSourceId): Promise<AlternativeSourceMatch | null> => {
        const provider = this.providers.get(altSourceId);
        if (!provider || settings.get(altSourceId)?.enabled === false) return null;
        const sourceName = settings.get(altSourceId)?.displayName ?? provider.displayName;

        try {
          let matchedItem: Awaited<ReturnType<MangaSourceProvider["search"]>>["items"][number] | undefined;
          for (const queryTitle of cleanTitles.slice(0, 2)) {
            const searchRes = await this.cache.wrap(
              `src:${altSourceId}:search:${JSON.stringify({ q: queryTitle, page: 1, limit: 10 })}`,
              TTL.search,
              () => provider.search({ q: queryTitle, page: 1, limit: 10 }),
            );
            provider.rememberSearchResults?.(searchRes.items);
            matchedItem = findMatchingSummary(searchRes.items, cleanTitles);
            if (matchedItem) break;
          }
          if (!matchedItem) return null;

          const chRes = await this.cache.wrap(
            `src:${altSourceId}:chapters:${matchedItem.externalId}:${language}:1:500`,
            TTL.chapters,
            () => provider.chapters(matchedItem!.externalId, { language, page: 1, limit: 500 }),
          );

          return buildAlternativeSourceMatch(
            altSourceId,
            sourceName,
            matchedItem,
            chRes,
            language,
            targetLabel,
            targetNum,
          );
        } catch (err) {
          this.log.warn(`Alternative source lookup on ${altSourceId} failed: ${(err as Error)?.message}`);
          return null;
        }
      }),
    );

    return results.filter((item): item is AlternativeSourceMatch => !!item && item.chapters.length > 0);
  }

  async publicAlternatives(sourceId: string, externalId: string, language = "en") {
    const title = await this.publishedTitle(sourceId, externalId);
    const details = await this.providerDetails(sourceId, externalId).catch(() => null);
    const candidateTitles = [
      title.comic?.title ?? "",
      title.title,
      title.comic?.altTitle ?? "",
      details?.title ?? "",
      ...(details?.alternativeTitles ?? []),
    ];
    const alternatives = await this.findAlternativeSources(candidateTitles, language);
    await Promise.all(
      alternatives.map((alt) =>
        this.ensureApprovedAlternativeSourceTitle({
          sourceId: alt.sourceId,
          externalId: alt.externalId,
          title: alt.title,
          sourceUrl: alt.sourceUrl,
          coverUrl: alt.coverUrl,
        }).catch(() => null),
      ),
    );
    return { sourceId, externalId, alternatives };
  }

  async adminAlternatives(sourceId: string, externalId: string, language = "en") {
    const [details, stored] = await Promise.all([
      this.resolveDetailsWithDbFallback(sourceId, externalId).catch(() => null),
      this.db.sourceTitle.findUnique({
        where: { sourceId_externalId: { sourceId, externalId } },
        include: { comic: { select: { title: true, altTitle: true } } },
      }).catch(() => null),
    ]);
    const candidateTitles = [
      details?.title ?? "",
      ...(details?.alternativeTitles ?? []),
      stored?.comic?.title ?? "",
      stored?.title ?? "",
      stored?.comic?.altTitle ?? "",
    ];
    const alternatives = await this.findAlternativeSources(candidateTitles, language);
    return { sourceId, externalId, alternatives };
  }

  async resolveAlternativeForComicChapter(chapterId: string): Promise<{
    external: {
      sourceId: string;
      mangaId: string;
      chapterId: string;
      sourceUrl: string;
      groups: string[];
      readerUrl: string;
    } | null;
    alternatives: AlternativeSourceMatch[];
  }> {
    const ch = await this.db.chapter.findUnique({
      where: { id: chapterId },
      include: {
        comic: { select: { id: true, title: true, altTitle: true } },
        sourceChapter: { include: { sourceTitle: true } },
      },
    });
    if (!ch?.sourceChapter || ch.sourceChapter.sourceTitle.sourceId !== "comick") {
      return { external: null, alternatives: [] };
    }

    // Check if ComicK has direct readable pages first.
    const comickPages = await this.pages(
      "comick",
      ch.sourceChapter.externalId,
      "data",
      ch.sourceChapter.sourceTitle.externalId,
    ).catch(() => null);
    if (comickPages && comickPages.pages.length > 0) {
      return { external: null, alternatives: [] };
    }

    const rawLabel = ch.sourceChapter.numberLabel ?? String(ch.number);
    const targetNum = Number.parseFloat(rawLabel);
    const candidateTitles = [
      ch.comic.title,
      ch.sourceChapter.sourceTitle.title,
      ch.comic.altTitle ?? "",
    ];

    const alternatives = await this.findAlternativeSources(
      candidateTitles,
      ch.sourceChapter.language ?? "en",
      rawLabel,
      Number.isNaN(targetNum) ? ch.number : targetNum,
    );

    for (const alt of alternatives) {
      await this.ensureApprovedAlternativeSourceTitle({
        sourceId: alt.sourceId,
        externalId: alt.externalId,
        title: alt.title,
        sourceUrl: alt.sourceUrl,
        coverUrl: alt.coverUrl,
        contentType: ch.sourceChapter.sourceTitle.contentType,
      }).catch(() => null);
    }

    const matchedAlt = alternatives.find((alt) => !!alt.matchedChapter);
    if (!matchedAlt || !matchedAlt.matchedChapter) {
      return { external: null, alternatives };
    }

    const altChapter = matchedAlt.matchedChapter;
    try {
      const altSourceTitle = await this.ensureApprovedAlternativeSourceTitle({
        sourceId: matchedAlt.sourceId,
        externalId: matchedAlt.externalId,
        title: matchedAlt.title,
        sourceUrl: matchedAlt.sourceUrl,
        coverUrl: matchedAlt.coverUrl,
        contentType: ch.sourceChapter.sourceTitle.contentType,
      });
      const existingConflict = await this.db.sourceChapter.findUnique({
        where: { sourceTitleId_externalId: { sourceTitleId: altSourceTitle.id, externalId: altChapter.id } },
        select: { id: true, chapterId: true },
      });
      if (!existingConflict || existingConflict.chapterId === ch.id) {
        await this.db.sourceChapter.update({
          where: { id: ch.sourceChapter.id },
          data: {
            sourceTitleId: altSourceTitle.id,
            externalId: altChapter.id,
            sourceUrl: altChapter.sourceUrl,
            groups: altChapter.groups,
            language: altChapter.language ?? ch.sourceChapter.language,
          },
        });
      }
    } catch {
      // Even if DB update is skipped due to a concurrent request, still return the preserved alternative source IDs.
    }

    return {
      external: {
        sourceId: matchedAlt.sourceId,
        mangaId: matchedAlt.externalId,
        chapterId: altChapter.id,
        sourceUrl: altChapter.sourceUrl,
        groups: altChapter.groups,
        readerUrl: altChapter.readerUrl,
      },
      alternatives,
    };
  }

  async list() {
    if (!this.cfg.enabled) return { enabled: false, sources: [] };
    const settings = await this.settings();
    const sources = [...this.providers.values()].filter((p) => settings.get(p.id)?.enabled !== false)
      .map((p) => ({ ...p.info(), displayName: settings.get(p.id)?.displayName ?? p.displayName }));
    return { enabled: true, sources };
  }
  async one(sourceId: string) {
    const p = await this.available(sourceId);
    const s = await this.db.sourceSetting.findUnique({ where: { sourceId } });
    return { ...p.info(), displayName: s?.displayName ?? p.displayName };
  }
  health(sourceId: string) { return this.run(sourceId, (p) => p.health()); }

  async search(sourceId: string, q: SearchQuery) {
    return this.run(sourceId, async (p) => {
      const result = await this.cache.wrap(`src:${sourceId}:search:${JSON.stringify(q)}`, TTL.search, () => p.search(q));
      // Restore provider-local search metadata even when Redis/in-memory API cache served this page.
      p.rememberSearchResults?.(result.items);
      return result;
    });
  }
  private providerDetails(sourceId: string, externalId: string) {
    return this.run(sourceId, (p) => this.cache.wrap(`src:${sourceId}:manga:${externalId}`, TTL.details, () => p.details(externalId)));
  }
  async details(sourceId: string, externalId: string) {
    await this.publishedTitle(sourceId, externalId);
    return this.providerDetails(sourceId, externalId);
  }
  private providerChapters(sourceId: string, externalId: string, o: { language: string; page: number; limit: number }) {
    const limit = sourceId === "comick" ? Math.min(Math.max(o.limit, 1), 20) : o.limit;
    if ((o.page - 1) * limit + limit > MAX_SOURCE_OFFSET) throw new BadRequestException("Chapter pagination is limited to the first 10,000 results.");
    return this.run(sourceId, (p) => this.cache.wrap(`src:${sourceId}:chapters:${externalId}:${o.language}:${o.page}:${limit}`, TTL.chapters, () => p.chapters(externalId, { ...o, limit })));
  }
  async chapters(sourceId: string, externalId: string, o: { language: string; page: number; limit: number }) {
    const title = await this.publishedTitle(sourceId, externalId);
    const where = { sourceTitleId: title.id, chapter: { publishState: "PUBLISHED" as const, deletedAt: null } };
    const [total, rows] = await Promise.all([
      this.db.sourceChapter.count({ where }),
      this.db.sourceChapter.findMany({
        where, include: { chapter: { select: { id: true, number: true, title: true, publishedAt: true } } },
        orderBy: { chapter: { number: "asc" } }, skip: (o.page - 1) * o.limit, take: o.limit,
      }),
    ]);
    if (total === 0 && !title.comicId) {
      return this.providerChapters(sourceId, externalId, o);
    }
    return {
      items: rows.map((r) => ({
        id: r.externalId, sourceId, mangaId: externalId,
        number: r.numberLabel === null ? null : Number.parseFloat(r.numberLabel),
        numberLabel: r.numberLabel, title: r.title, volume: r.volume, language: r.language,
        publishedAt: r.publishedAt?.toISOString() ?? r.chapter.publishedAt?.toISOString() ?? null,
        groups: r.groups, pageCount: r.pageCount, sourceUrl: r.sourceUrl, duplicateNumber: false,
      })),
      total, page: o.page, limit: o.limit, hasMore: (o.page - 1) * o.limit + rows.length < total,
    };
  }
  pages(sourceId: string, chapterId: string, quality: "data" | "data-saver", mangaId?: string) {
    return this.run(sourceId, (p) => p.pages(chapterId, { quality }, mangaId));
  }
  async publicPages(sourceId: string, externalId: string, chapterId: string, quality: "data" | "data-saver") {
    const title = await this.publishedTitle(sourceId, externalId);
    if (title.comicId !== null) {
      const chapter = await this.db.sourceChapter.findFirst({
        where: { sourceTitleId: title.id, externalId: chapterId, chapter: { publishState: "PUBLISHED", deletedAt: null } },
        select: { id: true },
      });
      if (!chapter) throw new NotFoundException("Chapter not found.");
    }
    const pages = await this.pages(sourceId, chapterId, quality, externalId);
    if (pages.mangaId && pages.mangaId !== externalId) throw new NotFoundException("Chapter not found.");
    return pages;
  }
  async publishedChapterPages(chapterId: string, from: number, limit: number) {
    const row = await this.db.sourceChapter.findFirst({
      where: { chapterId, chapter: { publishState: "PUBLISHED", deletedAt: null, comic: { publishState: "PUBLISHED", deletedAt: null } }, sourceTitle: { state: "APPROVED" } },
      include: { sourceTitle: true },
    });
    if (!row) return null;

    let effectiveSourceId = row.sourceTitle.sourceId;
    let effectiveMangaId = row.sourceTitle.externalId;
    let effectiveChapterId = row.externalId;

    if (effectiveSourceId === "comick") {
      const resolved = await this.resolveAlternativeForComicChapter(chapterId);
      if (resolved.external) {
        effectiveSourceId = resolved.external.sourceId;
        effectiveMangaId = resolved.external.mangaId;
        effectiveChapterId = resolved.external.chapterId;
      }
    }

    const pages = await this.pages(effectiveSourceId, effectiveChapterId, "data", effectiveMangaId);
    const total = pages.pages.length;
    return {
      total, from, items: pages.pages.slice(from, from + limit).map((page) => ({
        id: `${effectiveChapterId}:${page.pageNumber}`, position: page.pageNumber - 1, width: page.width ?? 0, height: page.height ?? 0, url: page.imageUrl,
      })),
    };
  }
  async cover(sourceId: string, mangaId: string, file: string) {
    await this.publishedTitle(sourceId, mangaId);
    const provider = await this.available(sourceId);
    if (!provider.cover) throw new NotFoundException("Cover not found.");
    return provider.cover(mangaId, file);
  }
  async adminCover(sourceId: string, mangaId: string, file: string) {
    const provider = await this.available(sourceId);
    if (!provider.cover) throw new NotFoundException("Cover not found.");
    return provider.cover(mangaId, file);
  }

  // ---- reader's saved titles (metadata and a link only; never chapters or images)
  async save(userId: string, sourceId: string, externalId: string) {
    const d = await this.details(sourceId, externalId);
    const data = { title: d.title, coverUrl: d.coverUrl, status: d.status, contentType: d.contentType, sourceUrl: d.sourceUrl };
    const row = await this.db.externalLibraryEntry.upsert({ where: { userId_sourceId_externalId: { userId, sourceId, externalId } }, update: data, create: { userId, sourceId, externalId, ...data } });
    return { id: row.id };
  }
  remove(userId: string, sourceId: string, externalId: string) { return this.db.externalLibraryEntry.deleteMany({ where: { userId, sourceId, externalId } }); }
  async isSaved(userId: string, sourceId: string, externalId: string) {
    try { await this.publishedTitle(sourceId, externalId); } catch (e) { if (e instanceof NotFoundException) return { saved: false }; throw e; }
    return { saved: !!(await this.db.externalLibraryEntry.findUnique({ where: { userId_sourceId_externalId: { userId, sourceId, externalId } }, select: { id: true } })) };
  }
  async library(userId: string) {
    const titles = await this.db.sourceTitle.findMany({
      where: { state: "APPROVED", comic: { publishState: "PUBLISHED", deletedAt: null } },
      select: { sourceId: true, externalId: true },
    });
    if (!titles.length) return [];
    const where: Prisma.ExternalLibraryEntryWhereInput[] = titles.map(({ sourceId, externalId }) => ({ sourceId, externalId }));
    return this.db.externalLibraryEntry.findMany({ where: { userId, OR: where }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  // ---- admin
  async adminList() {
    const settings = await this.settings();
    return {
      enabled: this.cfg.enabled,
      config: { timeoutMs: this.cfg.timeoutMs, hosts: [...this.providers.values()].map((provider) => new URL(provider.info().officialUrl).host) },
      sources: [...this.providers.values()].map((p) => ({
        ...p.info(), defaultName: p.displayName, displayName: settings.get(p.id)?.displayName ?? p.displayName, enabled: settings.get(p.id)?.enabled !== false,
        recentErrors: this.errors.filter((e) => e.sourceId === p.id).slice(-10).reverse(),
      })),
    };
  }

  async adminAlerts() {
    const titles = await this.db.sourceTitle.findMany({
      where: { state: { in: ["APPROVED", "UNPUBLISHED"] }, comic: { publishState: "PUBLISHED", deletedAt: null } },
      select: {
        id: true, sourceId: true, externalId: true, title: true, comicId: true,
        comic: { select: { id: true, title: true, slug: true } },
        chapters: { select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const alerts: { id: string; comicId: string; comicTitle: string; sourceId: string; sourceName: string; title: string; availableCount: number; totalSourceChapters: number; url: string }[] = [];
    for (const row of titles) {
      const provider = this.providers.get(row.sourceId);
      if (!provider || !row.comic) continue;
      let sourceChapters: ChaptersResponse;
      try {
        sourceChapters = await this.providerChapters(row.sourceId, row.externalId, {
          language: "en", page: 1, limit: row.sourceId === "comick" ? 20 : 50,
        });
      } catch {
        continue;
      }
      const imported = row.chapters.length;
      const availableCount = Math.max(0, sourceChapters.total - imported);
      if (availableCount <= 0) continue;
      const sourceSetting = await this.db.sourceSetting.findUnique({ where: { sourceId: row.sourceId }, select: { displayName: true } });
      alerts.push({
        id: row.id, comicId: row.comicId!, comicTitle: row.comic.title, sourceId: row.sourceId,
        sourceName: sourceSetting?.displayName ?? provider.displayName, title: row.title,
        availableCount, totalSourceChapters: sourceChapters.total, url: `/admin/chapters?comicId=${row.comicId}`,
      });
    }
    return alerts.sort((a, b) => b.availableCount - a.availableCount);
  }

  async updateSetting(sourceId: string, d: { enabled?: boolean; displayName?: string }, actorId: string) {
    if (!this.providers.has(sourceId)) throw new NotFoundException("Unknown source.");
    const data = { ...(typeof d.enabled === "boolean" && { enabled: d.enabled }), ...(d.displayName !== undefined && { displayName: d.displayName.trim() || null }) };
    await this.db.$transaction([
      this.db.sourceSetting.upsert({ where: { sourceId }, update: data, create: { sourceId, ...data } }),
      this.db.auditLog.create({ data: { actorId, action: "source.update", resource: "Source", resourceId: sourceId, meta: data } }),
    ]);
  }
  async test(sourceId: string) {
    const p = this.providers.get(sourceId);
    if (!this.cfg.enabled || !p) throw new HttpException(this.cfg.enabled ? "Unknown source." : "External sources are turned off on this server.", this.cfg.enabled ? 404 : 503);
    const r = await p.health();
    if (!r.ok) this.record(sourceId, new SourceError("SOURCE_UNAVAILABLE", r.message ?? "Connectivity test failed"));
    return r;
  }

  async adminSearch(sourceId: string, q: SearchQuery) {
    const result = await this.search(sourceId, q);
    if (!result.items.length) return result;
    const known = await this.db.sourceTitle.findMany({
      where: { sourceId, externalId: { in: result.items.map((item) => item.externalId) } },
      select: { externalId: true, state: true, comic: { select: { slug: true, deletedAt: true } } },
    });
    const states = new Map(known.map((row) => [row.externalId, row]));
    return {
      ...result,
      items: result.items.map((item) => {
        const review = states.get(item.externalId);
        // Older versions left the SourceTitle attached to a soft-deleted Comic.
        // Treat that title as awaiting approval so the administrator can publish it again.
        const archivedPublication = !!review && (review.state === "APPROVED" || review.state === "UNPUBLISHED") && (!review.comic || review.comic.deletedAt !== null);
        return {
          ...item,
          coverUrl: item.coverUrl?.replace(/^\/sources\//, "/admin/sources/") ?? null,
          reviewState: archivedPublication ? null : review?.state ?? null,
          comicSlug: archivedPublication ? null : review?.comic?.slug ?? null,
        };
      }),
    };
  }

  private async resolveDetailsWithDbFallback(sourceId: string, externalId: string): Promise<MangaDetails> {
    try {
      return await this.providerDetails(sourceId, externalId);
    } catch (error) {
      if (error instanceof HttpException && (error.getStatus() === 503 || error.getStatus() === 504)) {
        const stored = await this.db.sourceTitle.findUnique({
          where: { sourceId_externalId: { sourceId, externalId } },
          include: { comic: true },
        });
        if (stored) {
          const validType: ContentType = ["manga", "manhwa", "manhua"].includes(stored.contentType)
            ? (stored.contentType as ContentType)
            : "manga";
          const fallback: MangaDetails = {
            id: externalId,
            externalId,
            sourceId,
            title: stored.title,
            alternativeTitles: stored.comic?.altTitle ? [stored.comic.altTitle] : [],
            coverUrl: stored.coverUrl,
            description: stored.comic?.description ?? null,
            status: stored.comic?.status?.toLowerCase() ?? "ongoing",
            genres: [],
            contentType: validType,
            language: "en",
            sourceUrl: stored.sourceUrl,
            authors: stored.comic?.author ? [stored.comic.author] : [],
            artists: stored.comic?.artist ? [stored.comic.artist] : [],
            year: stored.comic?.releaseYear ?? null,
            availableLanguages: ["en"],
            metadataFallback: "search",
          };
          this.providers.get(sourceId)?.rememberSearchResults?.([fallback]);
          return fallback;
        }
      }
      throw error;
    }
  }

  async adminDetails(sourceId: string, externalId: string) {
    const [details, review] = await Promise.all([
      this.resolveDetailsWithDbFallback(sourceId, externalId),
      this.db.sourceTitle.findUnique({ where: { sourceId_externalId: { sourceId, externalId } }, select: { state: true, reviewNote: true, reviewedAt: true, comic: { select: { id: true, slug: true, publishState: true, deletedAt: true } } } }),
    ]);
    const archivedPublication = !!review && (review.state === "APPROVED" || review.state === "UNPUBLISHED") && (!review.comic || review.comic.deletedAt !== null);
    return {
      ...details,
      coverUrl: details.coverUrl?.replace(/^\/sources\//, "/admin/sources/") ?? null,
      review: archivedPublication ? null : review,
    };
  }

  adminChapters(sourceId: string, externalId: string, q: { language: string; page: number; limit: number }) {
    return this.providerChapters(sourceId, externalId, q);
  }

  async adminComicChapters(comicId: string, q: { language: string; page: number; limit: number }) {
    const title = await this.db.sourceTitle.findUnique({
      where: { comicId },
      include: { comic: { select: { id: true, title: true, altTitle: true } } },
    });
    if (!title) return { source: null, chapters: null, alternatives: [] };

    const [details, chaptersResult, setting] = await Promise.all([
      this.resolveDetailsWithDbFallback(title.sourceId, title.externalId).catch(() => null),
      this.providerChapters(title.sourceId, title.externalId, q).catch((): ChaptersResponse => ({
        items: [],
        total: 0,
        page: q.page,
        limit: title.sourceId === "comick" ? 20 : q.limit,
        hasMore: false,
      })),
      this.db.sourceSetting.findUnique({ where: { sourceId: title.sourceId }, select: { displayName: true } }),
    ]);

    const existingComicChapters = await this.db.chapter.findMany({
      where: { comicId, deletedAt: null },
      select: { id: true, number: true, sourceChapter: { select: { externalId: true, numberLabel: true, sourceTitle: { select: { sourceId: true, externalId: true } } } } },
    });

    const importedExternalIds = new Set(
      existingComicChapters
        .map((row) => row.sourceChapter?.externalId)
        .filter((id): id is string => !!id),
    );

    const availableLanguages = details?.availableLanguages?.length
      ? [...new Set(["en", ...details.availableLanguages])]
      : ["en"];

    let alternatives: (AlternativeSourceMatch & { chapters: (AlternativeChapterItem & { imported: boolean })[] })[] = [];
    if (title.sourceId === "comick") {
      const candidateTitles = [
        title.comic?.title ?? "",
        title.title,
        title.comic?.altTitle ?? "",
        details?.title ?? "",
        ...(details?.alternativeTitles ?? []),
      ];
      const rawAlternatives = await this.findAlternativeSources(candidateTitles, q.language);
      alternatives = rawAlternatives.map((alt) => ({
        ...alt,
        chapters: alt.chapters.map((ch) => {
          const alreadyLinked = existingComicChapters.some((existing) =>
            existing.sourceChapter?.sourceTitle.sourceId === alt.sourceId &&
            existing.sourceChapter?.externalId === ch.id,
          );
          return { ...ch, imported: alreadyLinked };
        }),
      }));
    }

    return {
      source: {
        id: title.sourceId,
        externalId: title.externalId,
        title: title.title,
        state: title.state,
        displayName: setting?.displayName ?? this.providers.get(title.sourceId)?.displayName ?? title.sourceId,
        availableLanguages,
      },
      chapters: {
        ...chaptersResult,
        items: chaptersResult.items.map((chapter) => ({ ...chapter, imported: importedExternalIds.has(chapter.id) })),
      },
      alternatives,
    };
  }

  async importAlternativeChaptersForComic(
    comicId: string,
    altSourceId: string,
    altExternalId: string,
    q: { language: string; page: number; limit: number },
    actorId: string,
  ) {
    if (!ALTERNATIVE_PROVIDER_IDS.includes(altSourceId as typeof ALTERNATIVE_PROVIDER_IDS[number])) {
      throw new BadRequestException("Unsupported alternative chapter source.");
    }
    const comic = await this.db.comic.findFirst({
      where: { id: comicId, deletedAt: null },
      include: { sourceTitle: true },
    });
    if (!comic) throw new NotFoundException("Comic not found.");

    const [altDetails, altChapters] = await Promise.all([
      this.providerDetails(altSourceId, altExternalId).catch(() => null),
      this.providerChapters(altSourceId, altExternalId, q),
    ]);

    const altTitleRow = await this.ensureApprovedAlternativeSourceTitle({
      sourceId: altSourceId,
      externalId: altExternalId,
      title: altDetails?.title ?? comic.title,
      sourceUrl: altDetails?.sourceUrl ?? this.providers.get(altSourceId)?.info().officialUrl ?? "",
      coverUrl: altDetails?.coverUrl ?? comic.externalCoverUrl ?? null,
      contentType: altDetails?.contentType ?? comic.sourceTitle?.contentType ?? "manga",
    });

    const orderedItems = [...altChapters.items].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    const result = await this.db.$transaction(async (tx) => {
      const existingChapters = await tx.chapter.findMany({
        where: { comicId, deletedAt: null },
        include: { sourceChapter: { include: { sourceTitle: true } } },
        orderBy: { number: "asc" },
      });
      let nextNumber = (existingChapters.reduce((max: number, ch: { number: number }) => Math.max(max, ch.number), 0)) + 1;
      let importedCount = 0;
      let linkedCount = 0;
      const seenIds = new Set<string>();

      for (const item of orderedItems) {
        if (!item?.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        const alreadyExistsOnAlt = await tx.sourceChapter.findUnique({
          where: { sourceTitleId_externalId: { sourceTitleId: altTitleRow.id, externalId: item.id } },
          select: { id: true },
        });
        if (alreadyExistsOnAlt) continue;

        const matchingExisting = existingChapters.find((ch: any) => {
          const existingLabel = ch.sourceChapter?.numberLabel ?? String(ch.number);
          return chapterNumbersMatch(item.numberLabel, item.number, existingLabel, ch.number);
        });

        if (matchingExisting && matchingExisting.sourceChapter && matchingExisting.sourceChapter.sourceTitle.sourceId === "comick") {
          await tx.sourceChapter.update({
            where: { id: matchingExisting.sourceChapter.id },
            data: {
              sourceTitleId: altTitleRow.id,
              externalId: item.id,
              numberLabel: item.numberLabel ?? matchingExisting.sourceChapter.numberLabel,
              title: item.title ?? matchingExisting.sourceChapter.title,
              volume: item.volume ?? matchingExisting.sourceChapter.volume,
              sourceUrl: item.sourceUrl,
              language: item.language,
              publishedAt: safeDate(item.publishedAt) ?? matchingExisting.sourceChapter.publishedAt,
              pageCount: item.pageCount,
              groups: item.groups,
            },
          });
          linkedCount++;
          continue;
        }

        const desiredNumber =
          item.number !== null && !Number.isNaN(item.number) && !existingChapters.some((c: { number: number }) => Math.abs(c.number - item.number!) < 0.001)
            ? item.number
            : nextNumber++;

        const created = await tx.chapter.create({
          data: {
            comicId,
            number: desiredNumber,
            title: chapterTitle(item),
            publishState: "PUBLISHED",
            publishedAt: safeDate(item.publishedAt) ?? new Date(),
            sourceChapter: {
              create: {
                sourceTitleId: altTitleRow.id,
                externalId: item.id,
                numberLabel: item.numberLabel,
                title: item.title,
                volume: item.volume,
                sourceUrl: item.sourceUrl,
                language: item.language,
                publishedAt: safeDate(item.publishedAt),
                pageCount: item.pageCount,
                groups: item.groups,
              },
            },
          },
          include: { sourceChapter: { include: { sourceTitle: true } } },
        });
        existingChapters.push(created);
        importedCount++;
      }

      if (importedCount > 0 || linkedCount > 0) {
        await tx.comic.update({ where: { id: comicId }, data: { updatedAt: new Date() } });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: "source.title.alternative_chapters_import",
          resource: "Comic",
          resourceId: comicId,
          meta: {
            alternativeSourceId: altSourceId,
            alternativeExternalId: altExternalId,
            imported: importedCount,
            linkedExisting: linkedCount,
          },
        },
      });
      return { imported: importedCount, linkedExisting: linkedCount };
    });

    if (result.imported > 0 || result.linkedExisting > 0) await this.invalidateComicCaches();
    return {
      ...result,
      sourceId: altSourceId,
      externalId: altExternalId,
      total: altChapters.total,
      page: altChapters.page,
      limit: altChapters.limit,
      hasMore: altChapters.hasMore,
    };
  }

  async approve(
    sourceId: string,
    externalId: string,
    language: string,
    actorId: string,
    opts?: { chapterSourceId?: string; chapterExternalId?: string },
  ) {
    const pageLimit = sourceId === "comick" ? 20 : DEFAULT_CHAPTER_LIMIT;
    const [detailsResult, chapterResult] = await Promise.allSettled([
      this.resolveDetailsWithDbFallback(sourceId, externalId),
      this.providerChapters(sourceId, externalId, {
        language, page: 1, limit: pageLimit,
      }),
    ]);

    let chapterPage: ChaptersResponse;
    if (chapterResult.status === "fulfilled") {
      chapterPage = chapterResult.value;
    } else if (detailsResult.status === "fulfilled") {
      this.log.warn(`Chapter fetch during approval of ${sourceId}:${externalId} failed; checking alternative chapter sources: ${(chapterResult.reason as Error)?.message}`);
      chapterPage = { items: [], total: 0, page: 1, limit: pageLimit, hasMore: false };
    } else {
      throw detailsResult.reason;
    }

    let details: MangaDetails;
    if (detailsResult.status === "fulfilled") {
      details = detailsResult.value;
    } else {
      const firstSourceUrl = chapterPage.items[0]?.sourceUrl ?? `https://comick.dev/comic/${encodeURIComponent(externalId)}`;
      const slugPart = firstSourceUrl.split("/").filter(Boolean).pop() ?? externalId;
      const fallbackTitle = slugPart !== externalId
        ? slugPart.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : `ComicK Title (${externalId})`;
      details = {
        id: externalId,
        externalId,
        sourceId,
        title: fallbackTitle,
        alternativeTitles: [],
        coverUrl: null,
        description: null,
        status: "ongoing",
        genres: [],
        contentType: "manga",
        language,
        sourceUrl: firstSourceUrl,
        authors: [],
        artists: [],
        year: null,
        availableLanguages: [language || "en"],
        metadataFallback: "search",
      };
    }

    // Determine whether chapters should be sourced from an alternative provider (WeebCentral or Asura Scans)
    // while strictly preserving the alternative provider's own sourceId, externalId, chapter IDs, and URLs.
    let chapterSourceMeta: {
      sourceId: string;
      externalId: string;
      title: string;
      sourceUrl: string;
      coverUrl: string | null;
    } | null = null;

    if (opts?.chapterSourceId && opts?.chapterExternalId && opts.chapterSourceId !== sourceId) {
      const [altDetails, altChapters] = await Promise.all([
        this.providerDetails(opts.chapterSourceId, opts.chapterExternalId).catch(() => null),
        this.providerChapters(opts.chapterSourceId, opts.chapterExternalId, { language, page: 1, limit: DEFAULT_CHAPTER_LIMIT }),
      ]);
      chapterPage = altChapters;
      chapterSourceMeta = {
        sourceId: opts.chapterSourceId,
        externalId: opts.chapterExternalId,
        title: altDetails?.title ?? details.title,
        sourceUrl: altDetails?.sourceUrl ?? this.providers.get(opts.chapterSourceId)?.info().officialUrl ?? details.sourceUrl,
        coverUrl: altDetails?.coverUrl ?? details.coverUrl,
      };
    } else if (sourceId === "comick") {
      // Automatically search WeebCentral and Asura Scans when approving a ComicK title
      // if ComicK chapters are unavailable or lack direct page images.
      const alternatives = await this.findAlternativeSources(
        [details.title, ...details.alternativeTitles],
        language,
      );
      if (alternatives.length > 0) {
        const chosen = alternatives[0];
        chapterPage = {
          items: chosen.chapters,
          total: chosen.totalChapters,
          page: 1,
          limit: chosen.chapters.length || DEFAULT_CHAPTER_LIMIT,
          hasMore: chosen.totalChapters > chosen.chapters.length,
        };
        chapterSourceMeta = {
          sourceId: chosen.sourceId,
          externalId: chosen.externalId,
          title: chosen.title,
          sourceUrl: chosen.sourceUrl,
          coverUrl: chosen.coverUrl,
        };
      }
    }

    const type = CONTENT_TYPES[details.contentType] ?? (details.contentType === "unknown" ? ComicType.MANGA : undefined);
    if (!type) throw new BadRequestException("This source title has no supported manga, manhwa or manhua type.");
    const resolvedContentType = details.contentType === "unknown" ? "manga" : details.contentType;
    const releaseYear = details.year && details.year >= 1900 && details.year <= 2100 ? details.year : new Date().getFullYear();
    const slugBase = `${slugify(details.title) || "comic"}-${sourceId}-${externalId.slice(0, 8)}`;

    // Deduplicate chapters by externalId so repeated items in one page cannot cause P2002 conflicts.
    const uniqueChapters: ChapterItem[] = [];
    const seenChapterIds = new Set<string>();
    for (const item of chapterPage.items) {
      if (!item?.id || seenChapterIds.has(item.id)) continue;
      seenChapterIds.add(item.id);
      uniqueChapters.push(item);
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        const existing = await tx.sourceTitle.findUnique({
          where: { sourceId_externalId: { sourceId, externalId } },
          include: { comic: { select: { id: true, deletedAt: true } } },
        });
        if (existing?.comicId && existing.comic && existing.comic.deletedAt === null) {
          throw new ConflictException("This title is already linked to a ComicVerse comic. Use republish if it is unpublished.");
        }
        if (existing) await tx.sourceTitle.delete({ where: { id: existing.id } });
        let slug = slugBase, suffix = 2;
        while (await tx.comic.findUnique({ where: { slug }, select: { id: true } })) slug = `${slugBase}-${suffix++}`;
        const comic = await tx.comic.create({
          data: {
            slug, title: details.title.slice(0, 200), altTitle: details.alternativeTitles[0]?.slice(0, 200) ?? null,
            description: (details.description ?? "No description provided.").slice(0, 5000),
            author: (details.authors.join(", ") || "Unknown").slice(0, 120), artist: (details.artists.join(", ") || "Unknown").slice(0, 120),
            type, status: details.status === "completed" ? ComicStatus.COMPLETED : details.status === "hiatus" ? ComicStatus.HIATUS : ComicStatus.ONGOING,
            publishState: "PUBLISHED", releaseYear, externalCoverUrl: details.coverUrl,
          },
        });
        const sourceTitle = await tx.sourceTitle.upsert({
          where: { sourceId_externalId: { sourceId, externalId } },
          update: { title: details.title, sourceUrl: details.sourceUrl, coverUrl: details.coverUrl, contentType: resolvedContentType, state: "APPROVED", comicId: comic.id, reviewedById: actorId, reviewedAt: new Date(), reviewNote: null },
          create: { sourceId, externalId, title: details.title, sourceUrl: details.sourceUrl, coverUrl: details.coverUrl, contentType: resolvedContentType, state: "APPROVED", comicId: comic.id, reviewedById: actorId, reviewedAt: new Date() },
        });

        let targetChapterSourceTitleId = sourceTitle.id;
        if (chapterSourceMeta) {
          const altSourceTitle = await tx.sourceTitle.upsert({
            where: { sourceId_externalId: { sourceId: chapterSourceMeta.sourceId, externalId: chapterSourceMeta.externalId } },
            update: {
              title: chapterSourceMeta.title,
              sourceUrl: chapterSourceMeta.sourceUrl,
              coverUrl: chapterSourceMeta.coverUrl,
              contentType: resolvedContentType,
              state: "APPROVED",
              reviewedById: actorId,
              reviewedAt: new Date(),
            },
            create: {
              sourceId: chapterSourceMeta.sourceId,
              externalId: chapterSourceMeta.externalId,
              title: chapterSourceMeta.title,
              sourceUrl: chapterSourceMeta.sourceUrl,
              coverUrl: chapterSourceMeta.coverUrl,
              contentType: resolvedContentType,
              state: "APPROVED",
              reviewedById: actorId,
              reviewedAt: new Date(),
            },
          });
          targetChapterSourceTitleId = altSourceTitle.id;
        }

        let importedChaptersCount = 0;
        for (const [index, item] of uniqueChapters.entries()) {
          const existingSourceCh = await tx.sourceChapter.findUnique({
            where: { sourceTitleId_externalId: { sourceTitleId: targetChapterSourceTitleId, externalId: item.id } },
            select: { id: true },
          });
          if (existingSourceCh) continue;
          await tx.chapter.create({
            data: {
              comicId: comic.id, number: index + 1, title: chapterTitle(item), publishState: "PUBLISHED", publishedAt: safeDate(item.publishedAt) ?? new Date(),
              sourceChapter: { create: {
                sourceTitleId: targetChapterSourceTitleId, externalId: item.id, numberLabel: item.numberLabel, title: item.title,
                volume: item.volume, sourceUrl: item.sourceUrl, language: item.language, publishedAt: safeDate(item.publishedAt),
                pageCount: item.pageCount, groups: item.groups,
              } },
            },
          });
          importedChaptersCount++;
        }
        await tx.auditLog.create({
          data: {
            actorId,
            action: "source.title.approve",
            resource: "SourceTitle",
            resourceId: sourceTitle.id,
            meta: {
              sourceId,
              externalId,
              chapterSourceId: chapterSourceMeta?.sourceId ?? sourceId,
              chapterExternalId: chapterSourceMeta?.externalId ?? externalId,
              importedChapters: importedChaptersCount,
            },
          },
        });
        return {
          comicId: comic.id,
          slug: comic.slug,
          importedChapters: importedChaptersCount,
          hasMoreChapters: chapterPage.hasMore,
          chapterSourceId: chapterSourceMeta?.sourceId ?? sourceId,
          chapterExternalId: chapterSourceMeta?.externalId ?? externalId,
        };
      });
      await this.invalidateComicCaches();
      return result;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ConflictException("This source title or one of its chapters is already published.");
      throw e;
    }
  }

  async reject(sourceId: string, externalId: string, note: string | undefined, actorId: string) {
    const details = await this.resolveDetailsWithDbFallback(sourceId, externalId);
    await this.db.$transaction(async (tx) => {
      const current = await tx.sourceTitle.findUnique({
        where: { sourceId_externalId: { sourceId, externalId } },
        include: { comic: { select: { deletedAt: true } } },
      });
      if (current?.comicId && current.comic && current.comic.deletedAt === null) {
        throw new ConflictException("An approved title cannot be rejected. Unpublish it instead.");
      }
      if (current) await tx.sourceTitle.delete({ where: { id: current.id } });
      const row = await tx.sourceTitle.upsert({
        where: { sourceId_externalId: { sourceId, externalId } },
        update: { title: details.title, sourceUrl: details.sourceUrl, coverUrl: details.coverUrl, contentType: details.contentType, state: "REJECTED", reviewedById: actorId, reviewedAt: new Date(), reviewNote: note ?? null },
        create: { sourceId, externalId, title: details.title, sourceUrl: details.sourceUrl, coverUrl: details.coverUrl, contentType: details.contentType, state: "REJECTED", reviewedById: actorId, reviewedAt: new Date(), reviewNote: note ?? null },
      });
      await tx.auditLog.create({ data: { actorId, action: "source.title.reject", resource: "SourceTitle", resourceId: row.id, meta: { sourceId, externalId, note: note ?? null } } });
    });
  }

  async unpublish(sourceId: string, externalId: string, actorId: string) {
    await this.changePublication(sourceId, externalId, "UNPUBLISHED", "UNPUBLISHED", actorId);
  }

  async republish(sourceId: string, externalId: string, actorId: string) {
    await this.changePublication(sourceId, externalId, "APPROVED", "PUBLISHED", actorId);
  }

  private async changePublication(sourceId: string, externalId: string, state: SourceTitleState, publishState: "PUBLISHED" | "UNPUBLISHED", actorId: string) {
    await this.db.$transaction(async (tx) => {
      const row = await tx.sourceTitle.findUnique({
        where: { sourceId_externalId: { sourceId, externalId } },
        include: { comic: { select: { deletedAt: true } } },
      });
      if (!row?.comicId || !row.comic) throw new NotFoundException("Approved title not found.");
      if (publishState === "PUBLISHED" && row.state !== "UNPUBLISHED") throw new ConflictException("Only unpublished titles can be republished.");
      if (publishState === "UNPUBLISHED" && row.state !== "APPROVED") throw new ConflictException("Only published titles can be unpublished.");
      await tx.sourceTitle.update({ where: { id: row.id }, data: { state, reviewedById: actorId, reviewedAt: new Date() } });
      await tx.comic.update({
        where: { id: row.comicId },
        data: {
          publishState,
          ...(publishState === "PUBLISHED" ? { deletedAt: null } : {}),
          updatedAt: new Date(),
        },
      });
      await tx.auditLog.create({ data: { actorId, action: publishState === "PUBLISHED" ? "source.title.republish" : "source.title.unpublish", resource: "SourceTitle", resourceId: row.id, meta: { sourceId, externalId } } });
    });
    await this.invalidateComicCaches();
  }

  async importChapterPage(sourceId: string, externalId: string, q: { language: string; page: number; limit: number }, actorId: string) {
    const title = await this.db.sourceTitle.findUnique({
      where: { sourceId_externalId: { sourceId, externalId } },
      include: { comic: { select: { id: true } } },
    });
    const comicId = title?.comicId;
    if (!comicId || !title.comic) throw new NotFoundException("Approved title not found.");
    const result = await this.providerChapters(sourceId, externalId, q);
    const imported = await this.db.$transaction(async (tx) => {
      let next = ((await tx.chapter.aggregate({ where: { comicId, deletedAt: null }, _max: { number: true } }))._max.number ?? 0) + 1;
      let count = 0;
      const seenInBatch = new Set<string>();
      for (const item of result.items) {
        if (!item?.id || seenInBatch.has(item.id)) continue;
        seenInBatch.add(item.id);
        const exists = await tx.sourceChapter.findUnique({ where: { sourceTitleId_externalId: { sourceTitleId: title.id, externalId: item.id } }, select: { chapterId: true } });
        if (exists) continue;
        await tx.chapter.create({
          data: {
            comicId, number: next++, title: chapterTitle(item), publishState: "PUBLISHED", publishedAt: safeDate(item.publishedAt) ?? new Date(),
            sourceChapter: { create: {
              sourceTitleId: title.id, externalId: item.id, numberLabel: item.numberLabel, title: item.title,
              volume: item.volume, sourceUrl: item.sourceUrl, language: item.language, publishedAt: safeDate(item.publishedAt),
              pageCount: item.pageCount, groups: item.groups,
            } },
          },
        });
        count++;
      }
      if (count) await tx.comic.update({ where: { id: comicId }, data: { updatedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: "source.title.chapters_import", resource: "SourceTitle", resourceId: title.id, meta: { page: q.page, language: q.language, importedChapters: count } } });
      return count;
    });
    if (imported) await this.invalidateComicCaches();
    return { imported, hasMore: result.hasMore, total: result.total, page: result.page, limit: result.limit };
  }
}
