import { BadRequestException, ConflictException, HttpException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ComicStatus, ComicType, Prisma, SourceTitleState } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../common/util";
import { SourceError } from "./provider.interface";
import type {
  AlternativeSourceMatch,
  ChapterItem,
  ChaptersResponse,
  ContentType,
  MangaDetails,
  MangaSourceProvider,
  MangaSummary,
  SearchQuery,
} from "./provider.interface";
import type { SourcesConfig } from "./sources.config";
import {
  ALTERNATIVE_PROVIDER_IDS,
  buildAlternativeSourceMatch,
  chapterNumbersMatch,
  findMatchingSummary,
  normalizeMatchText,
  titlesRoughlyMatch,
} from "./alternative.normalize";

export const SOURCES_CONFIG = Symbol("SOURCES_CONFIG");
export const SOURCE_PROVIDERS = Symbol("SOURCE_PROVIDERS");

interface ErrorEntry { at: string; sourceId: string; code: string; message: string }
const TTL = { search: 300, details: 600, chapters: 300 }; // seconds. Page image URLs are temporary, so they are never cached.
const RECORDED = new Set(["SOURCE_UNAVAILABLE", "SOURCE_TIMEOUT", "SOURCE_RATE_LIMITED", "BAD_RESPONSE"]);
const MAX_SOURCE_OFFSET = 10_000;
const DEFAULT_CHAPTER_LIMIT = 500;
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

export interface FallbackCandidateItem {
  sourceId: string;
  sourceName: string;
  externalId: string;
  title: string;
  alternativeTitles: string[];
  coverUrl: string | null;
  contentType: ContentType;
  year: number | null;
  status: string | null;
  sourceUrl: string;
  linked: boolean;
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
    comicId?: string | null;
  }) {
    const contentType = alt.contentType && ["manga", "manhwa", "manhua"].includes(alt.contentType)
      ? alt.contentType
      : "manga";
    const existing = await this.db.sourceTitle.findUnique({
      where: { sourceId_externalId: { sourceId: alt.sourceId, externalId: alt.externalId } },
    });
    if (existing) {
      const updated = await this.db.sourceTitle.update({
        where: { id: existing.id },
        data: {
          title: alt.title,
          sourceUrl: alt.sourceUrl,
          coverUrl: alt.coverUrl,
          state: "APPROVED",
          ...(alt.comicId && !existing.comicId ? { comicId: alt.comicId } : {}),
        },
      });
      await this.db.setSourceTitleRole(updated.id, "CHAPTER_FALLBACK");
      return updated;
    }
    const created = await this.db.sourceTitle.create({
      data: {
        sourceId: alt.sourceId,
        externalId: alt.externalId,
        title: alt.title,
        sourceUrl: alt.sourceUrl,
        coverUrl: alt.coverUrl,
        contentType,
        state: "APPROVED",
        ...(alt.comicId ? { comicId: alt.comicId } : {}),
      },
    });
    await this.db.setSourceTitleRole(created.id, "CHAPTER_FALLBACK");
    return created;
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
          let matchedItem: MangaSummary | undefined;
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

    const rawLabel = ch.sourceChapter.numberLabel ?? String(ch.number);
    const targetNum = Number.parseFloat(rawLabel);
    const settings = await this.settings();

    // 1. Check if the comic has explicitly confirmed CHAPTER_FALLBACK sources first.
    const comicSourceTitles = await this.db.sourceTitle.findMany({
      where: { comicId: ch.comic.id, state: "APPROVED" },
    });
    const roleMap = await this.db.getSourceTitleRolesByIds(comicSourceTitles.map((st) => st.id));
    const linkedFallbacks = comicSourceTitles.filter(
      (st) => st.sourceId !== "comick" && (roleMap.get(st.id) === "CHAPTER_FALLBACK" || st.id !== ch.sourceChapter!.sourceTitleId),
    );

    for (const fb of linkedFallbacks) {
      const provider = this.providers.get(fb.sourceId);
      if (!provider || settings.get(fb.sourceId)?.enabled === false) continue;
      try {
        const chRes = await this.providerChapters(fb.sourceId, fb.externalId, {
          language: ch.sourceChapter.language ?? "en",
          page: 1,
          limit: DEFAULT_CHAPTER_LIMIT,
        });
        const match = chRes.items.find((item) =>
          chapterNumbersMatch(item.numberLabel, item.number, rawLabel, Number.isNaN(targetNum) ? ch.number : targetNum),
        );
        if (match) {
          const existingConflict = await this.db.sourceChapter.findUnique({
            where: { sourceTitleId_externalId: { sourceTitleId: fb.id, externalId: match.id } },
            select: { id: true, chapterId: true },
          });
          if (!existingConflict || existingConflict.chapterId === ch.id) {
            await this.db.sourceChapter.update({
              where: { id: ch.sourceChapter.id },
              data: {
                sourceTitleId: fb.id,
                externalId: match.id,
                sourceUrl: match.sourceUrl,
                groups: match.groups,
                language: match.language ?? ch.sourceChapter.language,
              },
            });
          }
          const lang = match.language ?? ch.sourceChapter.language ?? "en";
          return {
            external: {
              sourceId: fb.sourceId,
              mangaId: fb.externalId,
              chapterId: match.id,
              sourceUrl: match.sourceUrl,
              groups: match.groups,
              readerUrl: `/sources/${encodeURIComponent(fb.sourceId)}/${encodeURIComponent(fb.externalId)}/read/${encodeURIComponent(match.id)}?lang=${encodeURIComponent(lang)}`,
            },
            alternatives: [],
          };
        }
      } catch {
        // Continue to next fallback
      }
    }

    // 2. Otherwise search WeebCentral and Asura Scans for matching series & chapter.
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
      // Return preserved alternative identifiers even if concurrent update occurred.
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
    if (sourceId === "comick") {
      // ComicK chapters are not displayed directly; chapters come from linked CHAPTER_FALLBACK sources (WeebCentral / Asura Scans).
      return { items: [], total: 0, page: o.page, limit: o.limit, hasMore: false };
    }
    const where = { sourceTitleId: title.id, chapter: { publishState: "PUBLISHED" as const, deletedAt: null } };
    const [total, rows] = await Promise.all([
      this.db.sourceChapter.count({ where }),
      this.db.sourceChapter.findMany({
        where, include: { chapter: { select: { id: true, number: true, title: true, publishedAt: true } } },
        orderBy: { chapter: { number: "asc" } }, skip: (o.page - 1) * o.limit, take: o.limit,
      }),
    ]);
    if (total === 0) {
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
    const roleMap = await this.db.getSourceTitleRolesByIds([title.id]);
    const role = roleMap.get(title.id) ?? "PRIMARY";
    if (title.comicId !== null && role === "PRIMARY") {
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
      where: {
        chapterId,
        chapter: {
          publishState: "PUBLISHED",
          deletedAt: null,
          comic: { publishState: "PUBLISHED", deletedAt: null },
        },
        sourceTitle: { state: "APPROVED" },
      },
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
      if (row.sourceId === "comick") continue;
      const provider = this.providers.get(row.sourceId);
      if (!provider || !row.comic) continue;
      let sourceChapters: ChaptersResponse;
      try {
        sourceChapters = await this.providerChapters(row.sourceId, row.externalId, {
          language: "en", page: 1, limit: 50,
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
      this.db.sourceTitle.findUnique({
        where: { sourceId_externalId: { sourceId, externalId } },
        select: {
          id: true,
          state: true,
          reviewNote: true,
          reviewedAt: true,
          comic: { select: { id: true, slug: true, publishState: true, deletedAt: true } },
        },
      }),
    ]);
    const archivedPublication = !!review && (review.state === "APPROVED" || review.state === "UNPUBLISHED") && (!review.comic || review.comic.deletedAt !== null);
    return {
      ...details,
      coverUrl: details.coverUrl?.replace(/^\/sources\//, "/admin/sources/") ?? null,
      review: archivedPublication ? null : review,
    };
  }

  async adminChapters(sourceId: string, externalId: string, q: { language: string; page: number; limit: number }) {
    if (sourceId === "comick") {
      // Step 2 & 3: Request ComicK chapter catalogue, detect upstream page unavailability,
      // and never display ComicK chapters directly; direct admin to WeebCentral or Asura Scans fallback.
      await this.providerChapters(sourceId, externalId, { ...q, limit: 20 }).catch(() => null);
      return {
        items: [],
        total: 0,
        page: q.page,
        limit: 20,
        hasMore: false,
        upstreamUnavailable: true,
        upstreamMessage:
          "ComicK chapter images are unavailable upstream. ComicK chapters are hidden — approve the canonical ComicK title and link WeebCentral or Asura Scans as an alternative chapter source.",
      };
    }
    return this.providerChapters(sourceId, externalId, q);
  }

  /**
   * GET /admin/sources/comics/:id/chapters
   * Fetches chapters from the comic's active source:
   * - If the primary source is ComicK, ComicK chapters are never displayed; instead, chapters are fetched
   *   from the selected or first linked CHAPTER_FALLBACK source (WeebCentral or Asura Scans).
   */
  async adminComicChapters(comicId: string, q: { language: string; page: number; limit: number; sourceId?: string }) {
    const sourceTitles = await this.db.sourceTitle.findMany({
      where: { comicId },
      include: { comic: { select: { id: true, slug: true, title: true, altTitle: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (!sourceTitles.length) {
      return {
        source: null,
        primarySource: null,
        fallbacks: [],
        upstreamUnavailable: false,
        upstreamMessage: null,
        chapters: null,
      };
    }

    const roleMap = await this.db.getSourceTitleRolesByIds(sourceTitles.map((row) => row.id));
    const settings = await this.settings();
    const displayNameOf = (sid: string) => settings.get(sid)?.displayName ?? this.providers.get(sid)?.displayName ?? sid;

    const primaryRow =
      sourceTitles.find((row) => roleMap.get(row.id) === "PRIMARY" && row.sourceId === "comick") ??
      sourceTitles.find((row) => roleMap.get(row.id) === "PRIMARY") ??
      sourceTitles[0];
    const fallbackRows = sourceTitles.filter((row) => row.id !== primaryRow.id);

    const primarySource = {
      id: primaryRow.sourceId,
      sourceId: primaryRow.sourceId,
      externalId: primaryRow.externalId,
      title: primaryRow.title,
      sourceUrl: primaryRow.sourceUrl,
      coverUrl: primaryRow.coverUrl,
      contentType: primaryRow.contentType,
      state: primaryRow.state,
      role: "PRIMARY" as const,
      displayName: displayNameOf(primaryRow.sourceId),
    };

    const fallbacks = fallbackRows.map((row) => ({
      id: row.sourceId,
      sourceId: row.sourceId,
      externalId: row.externalId,
      title: row.title,
      sourceUrl: row.sourceUrl,
      coverUrl: row.coverUrl,
      contentType: row.contentType,
      state: row.state,
      role: "CHAPTER_FALLBACK" as const,
      displayName: displayNameOf(row.sourceId),
    }));

    const isComickPrimary = primaryRow.sourceId === "comick";
    let activeRow = primaryRow;
    if (q.sourceId && q.sourceId !== "comick") {
      const requested = sourceTitles.find((row) => row.sourceId === q.sourceId);
      if (requested) activeRow = requested;
    } else if (isComickPrimary) {
      activeRow = fallbackRows[0] ?? primaryRow;
    }

    // Step 3: ComicK chapters must NEVER be displayed; only linked alternatives (WeebCentral / Asura Scans).
    if (activeRow.sourceId === "comick") {
      await this.providerChapters("comick", activeRow.externalId, { language: q.language, page: 1, limit: 20 }).catch(() => null);
      return {
        source: {
          ...primarySource,
          availableLanguages: ["en"],
        },
        primarySource,
        fallbacks,
        upstreamUnavailable: true,
        upstreamMessage:
          "ComicK chapter images are unavailable upstream. Search WeebCentral or Asura Scans below, confirm the matching series, and import chapters from the linked alternative provider.",
        chapters: null,
      };
    }

    const [details, chaptersResult] = await Promise.all([
      this.resolveDetailsWithDbFallback(activeRow.sourceId, activeRow.externalId).catch(() => null),
      this.providerChapters(activeRow.sourceId, activeRow.externalId, {
        language: q.language,
        page: q.page,
        limit: q.limit,
      }),
    ]);

    const importedRows = chaptersResult.items.length
      ? await this.db.sourceChapter.findMany({
          where: {
            sourceTitleId: activeRow.id,
            externalId: { in: chaptersResult.items.map((chapter) => chapter.id) },
          },
          select: { externalId: true, chapterId: true },
        })
      : [];
    const importedMap = new Map(importedRows.map((row) => [row.externalId, row.chapterId]));

    const availableLanguages = details?.availableLanguages?.length
      ? [...new Set(["en", ...details.availableLanguages])]
      : ["en"];

    const activeSourceName = displayNameOf(activeRow.sourceId);
    const comicSlug = primaryRow.comic?.slug ?? null;

    return {
      source: {
        id: activeRow.sourceId,
        sourceId: activeRow.sourceId,
        externalId: activeRow.externalId,
        title: activeRow.title,
        sourceUrl: activeRow.sourceUrl,
        coverUrl: activeRow.coverUrl,
        contentType: activeRow.contentType,
        state: activeRow.state,
        role: activeRow.id === primaryRow.id ? ("PRIMARY" as const) : ("CHAPTER_FALLBACK" as const),
        displayName: activeSourceName,
        availableLanguages,
        comicSlug,
      },
      primarySource,
      fallbacks,
      upstreamUnavailable: isComickPrimary,
      upstreamMessage: isComickPrimary
        ? `ComicK chapters are hidden. Showing chapters from linked fallback source: ${activeSourceName}.`
        : null,
      chapters: {
        ...chaptersResult,
        items: chaptersResult.items.map((chapter) => {
          const importedChapterId = importedMap.get(chapter.id) ?? null;
          return {
            ...chapter,
            sourceId: activeRow.sourceId,
            sourceName: activeSourceName,
            mangaId: activeRow.externalId,
            imported: !!importedChapterId,
            importedChapterId,
            comicReaderUrl: importedChapterId && comicSlug ? `/comics/${comicSlug}/chapter/${importedChapterId}` : null,
            sourceReaderUrl: `/sources/${encodeURIComponent(activeRow.sourceId)}/${encodeURIComponent(activeRow.externalId)}/read/${encodeURIComponent(chapter.id)}?lang=${encodeURIComponent(chapter.language ?? q.language)}`,
          };
        }),
      },
    };
  }

  /**
   * GET /admin/sources/comics/:id/fallback-candidates
   * Searches WeebCentral and/or Asura Scans for alternative series matching the comic.
   */
  async adminFallbackCandidates(
    comicId: string,
    q: { q?: string; sourceId?: "weebcentral" | "asurascans"; page: number; limit: number },
  ) {
    const comic = await this.db.comic.findFirst({
      where: { id: comicId, deletedAt: null },
      select: { id: true, title: true, type: true, releaseYear: true },
    });
    if (!comic) throw new NotFoundException("Comic not found.");

    const comicSourceTitles = await this.db.sourceTitle.findMany({
      where: { comicId },
      orderBy: { createdAt: "asc" },
    });
    const roleMap = await this.db.getSourceTitleRolesByIds(comicSourceTitles.map((st) => st.id));
    const primaryTitle =
      comicSourceTitles.find((st) => roleMap.get(st.id) === "PRIMARY") ?? comicSourceTitles[0];

    const searchQuery = (q.q?.trim() || primaryTitle?.title || comic.title).trim();
    if (!searchQuery) return { query: "", items: [] as FallbackCandidateItem[] };

    const defaultContentType: ContentType =
      primaryTitle?.contentType && ["manga", "manhwa", "manhua"].includes(primaryTitle.contentType)
        ? (primaryTitle.contentType as ContentType)
        : ["manga", "manhwa", "manhua"].includes(comic.type.toLowerCase())
          ? (comic.type.toLowerCase() as ContentType)
          : "manhwa";

    const settings = await this.settings();
    const targetProviders = q.sourceId
      ? [q.sourceId]
      : [...ALTERNATIVE_PROVIDER_IDS];

    const linkedKeys = new Set(
      comicSourceTitles
        .filter((st) => st.id !== primaryTitle?.id || roleMap.get(st.id) === "CHAPTER_FALLBACK")
        .map((st) => `${st.sourceId}:${st.externalId}`),
    );

    const providerResults = await Promise.all(
      targetProviders.map(async (pid): Promise<FallbackCandidateItem[]> => {
        const provider = this.providers.get(pid);
        if (!provider || settings.get(pid)?.enabled === false) return [];
        const sourceName = settings.get(pid)?.displayName ?? provider.displayName;
        try {
          const res = await this.search(pid, {
            q: searchQuery,
            page: q.page ?? 1,
            limit: q.limit ?? 12,
          });
          return res.items.map((item) => {
            const cleanTitle = item.title.replace(/^Official\s+/i, "").trim() || item.title;
            const isMatch = titlesRoughlyMatch(cleanTitle, comic.title) || titlesRoughlyMatch(cleanTitle, searchQuery);
            return {
              sourceId: pid,
              sourceName,
              externalId: item.externalId,
              title: cleanTitle,
              alternativeTitles: item.alternativeTitles,
              coverUrl: item.coverUrl?.replace(/^\/sources\//, "/admin/sources/") ?? null,
              contentType: item.contentType !== "unknown" ? item.contentType : defaultContentType,
              year: item.year ?? (isMatch ? comic.releaseYear : null),
              status: item.status ?? null,
              sourceUrl: item.sourceUrl,
              linked: linkedKeys.has(`${pid}:${item.externalId}`),
            };
          });
        } catch (err) {
          this.log.warn(`Fallback candidate search failed on ${pid}: ${(err as Error)?.message}`);
          return [];
        }
      }),
    );

    return {
      query: searchQuery,
      items: providerResults.flat(),
    };
  }

  /**
   * POST /admin/sources/comics/:id/fallbacks
   * Links a confirmed WeebCentral or Asura Scans series to the comic with role = CHAPTER_FALLBACK.
   */
  async linkFallbackSource(
    comicId: string,
    dto: { sourceId: "weebcentral" | "asurascans"; externalId: string },
    actorId: string,
  ) {
    if (!ALTERNATIVE_PROVIDER_IDS.includes(dto.sourceId)) {
      throw new BadRequestException("Only WeebCentral and Asura Scans can be linked as fallback chapter sources.");
    }
    const comic = await this.db.comic.findFirst({
      where: { id: comicId, deletedAt: null },
      select: { id: true, title: true, slug: true },
    });
    if (!comic) throw new NotFoundException("Comic not found.");

    const details = await this.resolveDetailsWithDbFallback(dto.sourceId, dto.externalId).catch(async () => {
      const searchRes = await this.search(dto.sourceId, { q: comic.title, page: 1, limit: 12 }).catch(() => null);
      const found = searchRes?.items.find((item) => item.externalId === dto.externalId);
      if (found) {
        return {
          ...found,
          authors: found.authors ?? [],
          artists: found.artists ?? [],
          year: found.year ?? null,
          availableLanguages: found.availableLanguages ?? ["en"],
        } as MangaDetails;
      }
      throw new BadRequestException("Could not verify the selected fallback series.");
    });

    const settings = await this.settings();
    const displayName = settings.get(dto.sourceId)?.displayName ?? this.providers.get(dto.sourceId)?.displayName ?? dto.sourceId;
    const validContentType = details.contentType === "unknown" ? "manga" : details.contentType;

    const linked = await this.db.$transaction(async (tx) => {
      const existingByExternal = await tx.sourceTitle.findUnique({
        where: { sourceId_externalId: { sourceId: dto.sourceId, externalId: dto.externalId } },
        include: { comic: { select: { id: true, slug: true, deletedAt: true } } },
      });
      const previousComic =
        existingByExternal?.comicId &&
        existingByExternal.comicId !== comicId &&
        existingByExternal.comic &&
        existingByExternal.comic.deletedAt === null
          ? existingByExternal.comic
          : null;

      // If this comic already has a CHAPTER_FALLBACK for this sourceId with a different externalId, replace it.
      const existingForProvider = await tx.sourceTitle.findFirst({
        where: { comicId, sourceId: dto.sourceId },
      });
      if (existingForProvider && existingForProvider.externalId !== dto.externalId) {
        const providerRoleMap = await this.db.getSourceTitleRolesByIds([existingForProvider.id], tx);
        if (providerRoleMap.get(existingForProvider.id) === "PRIMARY" && existingForProvider.sourceId === "comick") {
          throw new ConflictException("Cannot overwrite the primary source for this provider.");
        }
        const oldSourceChapters = await tx.sourceChapter.findMany({
          where: { sourceTitleId: existingForProvider.id },
          select: { chapterId: true },
        });
        if (oldSourceChapters.length > 0) {
          await tx.chapter.deleteMany({
            where: {
              id: { in: oldSourceChapters.map((sc: { chapterId: string }) => sc.chapterId) },
              images: { none: {} },
            },
          });
        }
        await tx.sourceTitle.delete({ where: { id: existingForProvider.id } });
      }

      const row = await tx.sourceTitle.upsert({
        where: { sourceId_externalId: { sourceId: dto.sourceId, externalId: dto.externalId } },
        update: {
          title: details.title,
          sourceUrl: details.sourceUrl,
          coverUrl: details.coverUrl,
          contentType: validContentType,
          state: "APPROVED",
          comicId,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
        create: {
          sourceId: dto.sourceId,
          externalId: dto.externalId,
          title: details.title,
          sourceUrl: details.sourceUrl,
          coverUrl: details.coverUrl,
          contentType: validContentType,
          state: "APPROVED",
          comicId,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      await this.db.setSourceTitleRole(row.id, "CHAPTER_FALLBACK", tx);

      if (previousComic) {
        const remainingForPrevious = await tx.sourceTitle.count({
          where: { comicId: previousComic.id },
        });
        if (remainingForPrevious === 0) {
          const archivedSlug = previousComic.slug.includes("-deleted-")
            ? previousComic.slug
            : `${previousComic.slug.slice(0, 160)}-deleted-${previousComic.id.slice(-8)}-${Date.now().toString(36)}`;
          await tx.comic.update({
            where: { id: previousComic.id },
            data: {
              deletedAt: new Date(),
              publishState: "ARCHIVED",
              slug: archivedSlug,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: "source.fallback.link",
          resource: "Comic",
          resourceId: comicId,
          meta: { sourceId: dto.sourceId, externalId: dto.externalId, sourceTitleId: row.id, title: details.title, role: "CHAPTER_FALLBACK" },
        },
      });

      return row;
    });

    return {
      id: linked.sourceId,
      sourceId: linked.sourceId,
      externalId: linked.externalId,
      title: linked.title,
      sourceUrl: linked.sourceUrl,
      coverUrl: linked.coverUrl,
      contentType: linked.contentType,
      state: linked.state,
      role: "CHAPTER_FALLBACK" as const,
      displayName,
    };
  }

  /**
   * DELETE /admin/sources/comics/:id/fallbacks/:sourceId
   * Unlinks a CHAPTER_FALLBACK source from the comic and removes its source-backed chapters.
   */
  async unlinkFallbackSource(comicId: string, sourceId: string, actorId: string) {
    const candidates = await this.db.sourceTitle.findMany({
      where: { comicId, sourceId },
    });
    const roleMap = await this.db.getSourceTitleRolesByIds(candidates.map((c) => c.id));
    const fallback = candidates.find((c) => roleMap.get(c.id) === "CHAPTER_FALLBACK" || c.sourceId !== "comick");
    if (!fallback) throw new NotFoundException("Fallback source not found for this comic.");

    await this.db.$transaction(async (tx) => {
      const linkedChapters = await tx.sourceChapter.findMany({
        where: { sourceTitleId: fallback.id },
        select: { chapterId: true },
      });
      if (linkedChapters.length > 0) {
        await tx.chapter.deleteMany({
          where: {
            id: { in: linkedChapters.map((sc: { chapterId: string }) => sc.chapterId) },
            images: { none: {} },
          },
        });
      }
      await tx.sourceTitle.delete({ where: { id: fallback.id } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "source.fallback.unlink",
          resource: "Comic",
          resourceId: comicId,
          meta: { sourceId, externalId: fallback.externalId, sourceTitleId: fallback.id },
        },
      });
    });

    await this.invalidateComicCaches();
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
    await this.linkFallbackSource(
      comicId,
      { sourceId: altSourceId as "weebcentral" | "asurascans", externalId: altExternalId },
      actorId,
    );
    return this.importChapterPage(altSourceId, altExternalId, q, actorId);
  }

  async approve(
    sourceId: string,
    externalId: string,
    language: string,
    actorId: string,
    opts?: { chapterSourceId?: string; chapterExternalId?: string },
  ) {
    const isComick = sourceId === "comick";
    const pageLimit = isComick ? 20 : DEFAULT_CHAPTER_LIMIT;

    const [detailsResult, chapterResult] = await Promise.allSettled([
      this.resolveDetailsWithDbFallback(sourceId, externalId),
      isComick
        ? Promise.resolve<ChaptersResponse>({ items: [], total: 0, page: 1, limit: 20, hasMore: false })
        : this.providerChapters(sourceId, externalId, { language, page: 1, limit: pageLimit }),
    ]);

    let chapterPage: ChaptersResponse;
    if (chapterResult.status === "fulfilled") {
      chapterPage = chapterResult.value;
    } else if (detailsResult.status === "fulfilled") {
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
        title: (altDetails?.title ?? details.title).replace(/^Official\s+/i, "").trim() || details.title,
        sourceUrl: altDetails?.sourceUrl ?? this.providers.get(opts.chapterSourceId)?.info().officialUrl ?? details.sourceUrl,
        coverUrl: altDetails?.coverUrl ?? details.coverUrl,
      };
    } else if (isComick) {
      // Automatically find a matching series on WeebCentral or Asura Scans so approving a ComicK title
      // links its fallback source and imports chapters in 1 click without requiring 4 manual steps.
      const candidateTitles = [details.title, ...(details.alternativeTitles ?? [])].filter(Boolean);
      const autoMatches = await this.findAlternativeSources(candidateTitles, language).catch(() => []);
      const bestMatch = autoMatches[0];
      if (bestMatch) {
        const altChapters = await this.providerChapters(bestMatch.sourceId, bestMatch.externalId, {
          language,
          page: 1,
          limit: DEFAULT_CHAPTER_LIMIT,
        }).catch(() => null);
        if (altChapters) {
          chapterPage = altChapters;
        }
        chapterSourceMeta = {
          sourceId: bestMatch.sourceId,
          externalId: bestMatch.externalId,
          title: bestMatch.title.replace(/^Official\s+/i, "").trim() || details.title,
          sourceUrl: bestMatch.sourceUrl || details.sourceUrl,
          coverUrl: bestMatch.coverUrl ?? details.coverUrl,
        };
      }
    }

    const type = CONTENT_TYPES[details.contentType] ?? (details.contentType === "unknown" ? ComicType.MANGA : undefined);
    if (!type) throw new BadRequestException("This source title has no supported manga, manhwa or manhua type.");
    const resolvedContentType = details.contentType === "unknown" ? "manga" : details.contentType;
    const releaseYear = details.year && details.year >= 1900 && details.year <= 2100 ? details.year : new Date().getFullYear();
    const slugBase = `${slugify(details.title) || "comic"}-${sourceId}-${externalId.slice(0, 8)}`;

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

        // Clean up any existing active or soft-deleted duplicate comics with the same title or base slug
        // so re-adding a deleted comic never leaves multiple published copies on the home page.
        const cleanComicTitle = details.title.replace(/^Official\s+/i, "").trim().slice(0, 200) || details.title.slice(0, 200).trim();
        const targetNormKey = normalizeMatchText(cleanComicTitle).replace(/\s+/g, "");
        const candidateDups = await tx.comic.findMany({
          where: {
            OR: [
              { deletedAt: null },
              { deletedAt: { not: null }, slug: { startsWith: slugBase } },
            ],
          },
          select: { id: true, title: true, slug: true, deletedAt: true },
        });
        const duplicateComics = candidateDups.filter((c) => {
          if (c.deletedAt !== null) return c.slug.startsWith(slugBase);
          const key = normalizeMatchText(c.title).replace(/\s+/g, "");
          return !!targetNormKey && key === targetNormKey;
        });
        if (duplicateComics.length > 0) {
          const dupIds = duplicateComics.map((c) => c.id);
          await tx.sourceTitle.deleteMany({ where: { comicId: { in: dupIds } } });
          const now = new Date();
          await tx.chapter.updateMany({
            where: { comicId: { in: dupIds }, deletedAt: null },
            data: { deletedAt: now, publishState: "ARCHIVED" },
          });
          for (const dup of duplicateComics) {
            const archivedSlug = dup.slug.includes("-deleted-")
              ? dup.slug
              : `${dup.slug.slice(0, 160)}-deleted-${dup.id.slice(-8)}-${Date.now().toString(36)}`;
            await tx.comic.update({
              where: { id: dup.id },
              data: {
                deletedAt: dup.deletedAt ?? now,
                publishState: "ARCHIVED",
                slug: archivedSlug,
              },
            });
          }
        }

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
          update: {
            title: details.title,
            sourceUrl: details.sourceUrl,
            coverUrl: details.coverUrl,
            contentType: resolvedContentType,
            state: "APPROVED",
            comicId: comic.id,
            reviewedById: actorId,
            reviewedAt: new Date(),
            reviewNote: null,
          },
          create: {
            sourceId,
            externalId,
            title: details.title,
            sourceUrl: details.sourceUrl,
            coverUrl: details.coverUrl,
            contentType: resolvedContentType,
            state: "APPROVED",
            comicId: comic.id,
            reviewedById: actorId,
            reviewedAt: new Date(),
          },
        });
        await this.db.setSourceTitleRole(sourceTitle.id, "PRIMARY", tx);

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
              comicId: comic.id,
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
              comicId: comic.id,
              reviewedById: actorId,
              reviewedAt: new Date(),
            },
          });
          await this.db.setSourceTitleRole(altSourceTitle.id, "CHAPTER_FALLBACK", tx);
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
              role: "PRIMARY",
              chapterSourceId: chapterSourceMeta?.sourceId ?? (isComick ? null : sourceId),
              chapterExternalId: chapterSourceMeta?.externalId ?? (isComick ? null : externalId),
              importedChapters: importedChaptersCount,
            },
          },
        });
        return {
          comicId: comic.id,
          slug: comic.slug,
          importedChapters: importedChaptersCount,
          hasMoreChapters: chapterPage.hasMore,
          requiresFallback: isComick && !chapterSourceMeta,
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

  /**
   * POST /admin/sources/catalog/:sourceId/:externalId/chapters/import
   * Imports chapters (either the selected chapterIds or all unimported chapters on the page)
   * from an approved PRIMARY or CHAPTER_FALLBACK SourceTitle, storing each chapter with
   * that provider's own SourceTitle relationship and externalId.
   */
  async importChapterPage(
    sourceId: string,
    externalId: string,
    q: { language: string; page: number; limit: number },
    actorId: string,
    selectedChapterIds?: string[],
  ) {
    if (sourceId === "comick") {
      throw new BadRequestException("ComicK chapters cannot be imported directly. Link WeebCentral or Asura Scans as an alternative chapter source.");
    }
    const title = await this.db.sourceTitle.findUnique({
      where: { sourceId_externalId: { sourceId, externalId } },
      include: { comic: { select: { id: true, slug: true } } },
    });
    const comicId = title?.comicId;
    if (!comicId || !title.comic) throw new NotFoundException("Approved or linked source title not found.");
    const roleMap = await this.db.getSourceTitleRolesByIds([title.id]);

    const result = await this.providerChapters(sourceId, externalId, q);
    const filterSet = selectedChapterIds && selectedChapterIds.length > 0 ? new Set(selectedChapterIds) : null;
    const candidates = filterSet
      ? result.items.filter((item) => filterSet.has(item.id))
      : result.items;

    const orderedCandidates = [...candidates].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

    const imported = await this.db.$transaction(async (tx) => {
      const existingChapters = await tx.chapter.findMany({
        where: { comicId, deletedAt: null },
        include: { sourceChapter: { include: { sourceTitle: true } } },
        orderBy: { number: "asc" },
      });
      let next = (existingChapters.reduce((max: number, ch: { number: number }) => Math.max(max, ch.number), 0)) + 1;
      let count = 0;
      const seenInBatch = new Set<string>();

      for (const item of orderedCandidates) {
        if (!item?.id || seenInBatch.has(item.id)) continue;
        seenInBatch.add(item.id);

        const exists = await tx.sourceChapter.findUnique({
          where: { sourceTitleId_externalId: { sourceTitleId: title.id, externalId: item.id } },
          select: { chapterId: true },
        });
        if (exists) continue;

        const matchingComickChapter = existingChapters.find((ch: any) => {
          if (!ch.sourceChapter || ch.sourceChapter.sourceTitle.sourceId !== "comick") return false;
          const existingLabel = ch.sourceChapter.numberLabel ?? String(ch.number);
          return chapterNumbersMatch(item.numberLabel, item.number, existingLabel, ch.number);
        });

        if (matchingComickChapter && matchingComickChapter.sourceChapter) {
          await tx.sourceChapter.update({
            where: { id: matchingComickChapter.sourceChapter.id },
            data: {
              sourceTitleId: title.id,
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
          });
          matchingComickChapter.sourceChapter.sourceTitle = title;
          matchingComickChapter.sourceChapter.externalId = item.id;
          count++;
          continue;
        }

        const desiredNumber =
          item.number !== null &&
          !Number.isNaN(item.number) &&
          item.number > 0 &&
          !existingChapters.some((c: { number: number }) => Math.abs(c.number - item.number!) < 0.001)
            ? item.number
            : next++;

        const created = await tx.chapter.create({
          data: {
            comicId,
            number: desiredNumber,
            title: chapterTitle(item),
            publishState: "PUBLISHED",
            publishedAt: safeDate(item.publishedAt) ?? new Date(),
            sourceChapter: {
              create: {
                sourceTitleId: title.id,
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
        count++;
      }
      if (count) await tx.comic.update({ where: { id: comicId }, data: { updatedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "source.title.chapters_import",
          resource: "SourceTitle",
          resourceId: title.id,
          meta: {
            sourceId,
            externalId,
            role: roleMap.get(title.id) ?? "PRIMARY",
            page: q.page,
            language: q.language,
            selectedCount: filterSet ? filterSet.size : null,
            importedChapters: count,
          },
        },
      });
      return count;
    });
    if (imported) await this.invalidateComicCaches();
    return {
      imported,
      hasMore: result.hasMore,
      total: result.total,
      page: result.page,
      limit: result.limit,
      sourceId,
      externalId,
    };
  }
}
