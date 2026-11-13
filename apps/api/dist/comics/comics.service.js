"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComicsService = void 0;
const chapter_display_1 = require("../sources/chapter-display");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../cache/cache.service");
const prisma_service_1 = require("../prisma/prisma.service");
const util_1 = require("../common/util");
const storage_service_1 = require("../storage/storage.service");
const crypto_1 = require("crypto");
const include = { genres: { include: { genre: true } } };
function normalizeTitleKey(title) {
    return title
        .trim()
        .toLowerCase()
        .replace(/^official\s+/i, "")
        .replace(/[^a-z0-9]+/g, "");
}
function dedupeByTitle(rows) {
    const seenIds = new Set();
    const seenTitles = new Set();
    const out = [];
    for (const row of rows) {
        if (seenIds.has(row.id))
            continue;
        const key = normalizeTitleKey(row.title) || row.id;
        if (seenTitles.has(key))
            continue;
        seenIds.add(row.id);
        seenTitles.add(key);
        out.push(row);
    }
    return out;
}
let ComicsService = class ComicsService {
    db;
    cache;
    storage;
    constructor(db, cache, storage) {
        this.db = db;
        this.cache = cache;
        this.storage = storage;
    }
    get publicWhere() {
        return {
            publishState: "PUBLISHED",
            deletedAt: null,
        };
    }
    mediaUrl(key) { return key ? this.storage.readUrl(key) : Promise.resolve(null); }
    invalidateHomeCaches() {
        return Promise.all(["comics:trending", "comics:popular", "comics:popular:weekly", "comics:popular:monthly", "comics:latest"].map((key) => this.cache.delete(key)));
    }
    // Average comes from Rating rows only; it is never stored on the comic.
    async withRatings(items) {
        if (!items.length)
            return [];
        const g = await this.db.rating.groupBy({ by: ["comicId"], where: { comicId: { in: items.map((i) => i.id) } }, _avg: { value: true }, _count: true });
        const m = new Map(g.map((r) => [r.comicId, r]));
        const latest = await this.db.chapter.findMany({
            where: { comicId: { in: items.map((i) => i.id) }, publishState: "PUBLISHED", deletedAt: null },
            orderBy: [{ comicId: "asc" }, { number: "desc" }], distinct: ["comicId"],
            select: { id: true, comicId: true, number: true, title: true, publishedAt: true, sourceChapter: { select: { numberLabel: true, title: true, publishedAt: true } } },
        });
        const lm = new Map(latest.map((c) => [c.comicId, c]));
        const counts = await this.db.chapter.groupBy({
            by: ["comicId"], where: { comicId: { in: items.map((i) => i.id) }, publishState: "PUBLISHED", deletedAt: null }, _count: true,
        });
        const cm = new Map(counts.map((r) => [r.comicId, r._count]));
        return Promise.all(items.map(async (i) => {
            const latestChapter = lm.get(i.id);
            return {
                ...i, rating: m.get(i.id)?._avg.value ?? null, ratingCount: m.get(i.id)?._count ?? 0, chapterCount: cm.get(i.id) ?? 0,
                latestChapter: latestChapter ? { id: latestChapter.id, number: latestChapter.number, displayNumber: (0, chapter_display_1.resolveChapterDisplayNumber)(latestChapter, latestChapter.sourceChapter), publishedAt: (0, chapter_display_1.resolveChapterPublishedAt)(latestChapter, latestChapter.sourceChapter) } : null,
                coverUrl: i.externalCoverUrl ?? await this.mediaUrl(i.coverKey),
                bannerUrl: await this.mediaUrl(i.bannerKey),
            };
        }));
    }
    async list(q) {
        const genreSlugs = (q.genre ?? "").split(",").map((g) => g.trim()).filter(Boolean).slice(0, 6);
        const creator = q.creator?.trim();
        // Every selected genre must match (AND), so adding a genre narrows the results.
        const and = [
            ...genreSlugs.map((slug) => ({ genres: { some: { genre: { slug } } } })),
            ...(creator ? [{ OR: [{ author: { contains: creator, mode: "insensitive" } }, { artist: { contains: creator, mode: "insensitive" } }] }] : []),
        ];
        const where = {
            ...this.publicWhere,
            ...(q.q && {
                OR: [
                    { title: { contains: q.q, mode: "insensitive" } },
                    { altTitle: { contains: q.q, mode: "insensitive" } },
                    { author: { contains: q.q, mode: "insensitive" } },
                    { artist: { contains: q.q, mode: "insensitive" } },
                ],
            }),
            ...(and.length ? { AND: and } : {}),
            ...(q.type && { type: q.type }), ...(q.status && { status: q.status }), ...(q.year && { releaseYear: q.year }),
        };
        const baseOrder = { updated: { updatedAt: "desc" }, added: { createdAt: "desc" }, popular: { views: "desc" }, alpha: { title: "asc" } }[q.sort ?? "updated"] ?? { updatedAt: "desc" };
        const orderBy = [baseOrder, { createdAt: "desc" }];
        // Rating, chapter count and minimum filters are derived values (not columns), so those queries are filtered,
        // sorted and paginated in memory over the matching catalogue (capped) instead of in SQL.
        if (q.sort === "rating" || q.sort === "chapters" || q.minChapters || q.minRating) {
            const rows = await this.db.comic.findMany({ where, orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }], include, take: 1000 });
            let all = await this.withRatings(dedupeByTitle(rows));
            if (q.minRating)
                all = all.filter((i) => (i.rating ?? 0) >= q.minRating);
            if (q.minChapters)
                all = all.filter((i) => i.chapterCount >= q.minChapters);
            if (q.sort === "rating")
                all.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.ratingCount - a.ratingCount);
            else if (q.sort === "chapters")
                all.sort((a, b) => b.chapterCount - a.chapterCount);
            else if (q.sort === "popular")
                all.sort((a, b) => b.views - a.views);
            else if (q.sort === "added")
                all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            else if (q.sort === "alpha")
                all.sort((a, b) => a.title.localeCompare(b.title));
            const start = (q.page - 1) * q.pageSize;
            return { items: all.slice(start, start + q.pageSize), total: all.length, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(all.length / q.pageSize)) };
        }
        const [total, rows] = await this.db.$transaction([
            this.db.comic.count({ where }),
            this.db.comic.findMany({ where, orderBy, include, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
        ]);
        const uniqueRows = dedupeByTitle(rows);
        const items = await this.withRatings(uniqueRows);
        const adjustedTotal = Math.max(items.length, total - (rows.length - uniqueRows.length));
        return { items, total: adjustedTotal, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(adjustedTotal / q.pageSize)) };
    }
    async top(orderBy, take = 12) {
        const rows = await this.db.comic.findMany({
            where: this.publicWhere,
            orderBy: [orderBy, { createdAt: "desc" }],
            include,
            take: take * 2,
        });
        return this.withRatings(dedupeByTitle(rows).slice(0, take));
    }
    trending() { return this.cache.wrap("comics:trending", 60, () => this.top({ views: "desc" })); }
    popular(period = "all") {
        if (period === "all")
            return this.cache.wrap("comics:popular", 60, () => this.top({ views: "desc" }));
        return this.cache.wrap(`comics:popular:${period}`, 60, () => this.popularSince(period === "weekly" ? 7 : 30));
    }
    // Real period rankings from recorded COMIC_VIEW events; padded with all-time leaders so the list is never empty.
    async popularSince(days, take = 12) {
        const since = new Date(Date.now() - days * 86_400_000);
        const groups = await this.db.analyticsEvent.groupBy({
            by: ["comicId"], where: { type: "COMIC_VIEW", comicId: { not: null }, createdAt: { gte: since } },
            _count: { _all: true }, orderBy: { _count: { comicId: "desc" } }, take: take * 2,
        });
        const ids = groups.map((g) => g.comicId).filter((id) => !!id);
        const rows = ids.length ? await this.db.comic.findMany({ where: { ...this.publicWhere, id: { in: ids } }, include }) : [];
        const order = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        const ranked = dedupeByTitle(rows);
        if (ranked.length < take) {
            const fill = await this.db.comic.findMany({ where: this.publicWhere, orderBy: [{ views: "desc" }, { createdAt: "desc" }], include, take: take * 2 });
            ranked.push(...fill.filter((f) => !ranked.some((r) => r.id === f.id)));
        }
        return this.withRatings(dedupeByTitle(ranked).slice(0, take));
    }
    latest() { return this.cache.wrap("comics:latest", 60, () => this.top({ updatedAt: "desc" })); }
    async bySlug(slug) {
        const c = await this.db.comic.findFirst({ where: { slug, ...this.publicWhere }, include });
        if (!c)
            throw new common_1.NotFoundException("Comic not found.");
        const [withRating] = await this.withRatings([c]);
        const chapterCount = await this.db.chapter.count({ where: { comicId: c.id, publishState: "PUBLISHED", deletedAt: null } });
        return { ...withRating, chapterCount };
    }
    async chapters(comicId, order = "desc") {
        const comic = await this.db.comic.findFirst({ where: { id: comicId, ...this.publicWhere }, select: { id: true } });
        if (!comic)
            throw new common_1.NotFoundException("Comic not found.");
        const rows = await this.db.chapter.findMany({
            where: { comicId, publishState: "PUBLISHED", deletedAt: null }, orderBy: { number: order },
            select: { id: true, number: true, title: true, publishedAt: true, sourceChapter: { select: { numberLabel: true, title: true, publishedAt: true } } },
        });
        return rows.map(({ sourceChapter, ...chapter }) => ({ ...chapter, publishedAt: (0, chapter_display_1.resolveChapterPublishedAt)(chapter, sourceChapter), displayNumber: (0, chapter_display_1.resolveChapterDisplayNumber)(chapter, sourceChapter) }));
    }
    async genreConnect(slugs) {
        const found = await this.db.genre.findMany({ where: { slug: { in: slugs } } });
        if (found.length !== new Set(slugs).size)
            throw new common_1.BadRequestException("One or more genres do not exist.");
        return found.map((g) => ({ genre: { connect: { id: g.id } } }));
    }
    async uniqueSlug(title) {
        const base = (0, util_1.slugify)(title) || "comic";
        for (let n = 0;; n++) {
            const slug = n ? `${base}-${n + 1}` : base;
            if (!(await this.db.comic.findUnique({ where: { slug }, select: { id: true } })))
                return slug;
        }
    }
    async coverUploadUrl(contentType, size) {
        if (!storage_service_1.IMAGE_TYPES[contentType] || !Number.isInteger(size) || size < 1 || size > 10 * 1024 * 1024)
            throw new common_1.BadRequestException("Cover must be JPEG, PNG, WebP or AVIF and no larger than 10 MB.");
        const key = `comics/covers/${(0, crypto_1.randomUUID)()}.${storage_service_1.IMAGE_TYPES[contentType]}`;
        return { key, uploadUrl: await this.storage.presignPut(key, contentType), expiresInSeconds: 600 };
    }
    async validateCoverKey(key) {
        if (!key)
            return;
        if (!key.startsWith("comics/covers/") || key.includes(".."))
            throw new common_1.BadRequestException("Invalid cover image key.");
        await this.storage.inspect(key);
    }
    async create(dto, actor) {
        await this.validateCoverKey(dto.coverKey);
        await this.validateCoverKey(dto.bannerKey);
        const { genreSlugs, ...data } = dto;
        const genres = await this.genreConnect(genreSlugs);
        const slug = await this.uniqueSlug(dto.title);
        const comic = await this.db.$transaction(async (tx) => {
            const created = await tx.comic.create({ data: { ...data, slug, genres: { create: genres } }, include });
            await tx.auditLog.create({ data: { actorId: actor, action: "comic.create", resource: "Comic", resourceId: created.id } });
            return created;
        });
        await this.invalidateHomeCaches();
        return comic;
    }
    async update(id, dto, actor) {
        await this.validateCoverKey(dto.coverKey);
        await this.validateCoverKey(dto.bannerKey);
        const { genreSlugs, ...data } = dto;
        const genres = genreSlugs ? await this.genreConnect(genreSlugs) : undefined;
        const comic = await this.db.$transaction(async (tx) => {
            const exists = await tx.comic.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
            if (!exists)
                throw new common_1.NotFoundException("Comic not found.");
            if (genres)
                await tx.comicGenre.deleteMany({ where: { comicId: id } });
            const updated = await tx.comic.update({ where: { id }, data: { ...data, ...(genres && { genres: { create: genres } }) }, include });
            await tx.auditLog.create({ data: { actorId: actor, action: "comic.update", resource: "Comic", resourceId: id, meta: { fields: Object.keys(dto) } } });
            return updated;
        });
        await this.invalidateHomeCaches();
        return comic;
    }
    async remove(id, actor) {
        await this.db.$transaction(async (tx) => {
            const current = await tx.comic.findFirst({
                where: { id, deletedAt: null },
                select: { id: true, title: true, slug: true },
            });
            if (!current)
                throw new common_1.NotFoundException("Comic not found.");
            const normCurrent = normalizeTitleKey(current.title);
            const activeComics = await tx.comic.findMany({
                where: { deletedAt: null },
                select: { id: true, title: true, slug: true },
            });
            const sameTitleComics = activeComics.filter((c) => c.id === current.id || (normCurrent && normalizeTitleKey(c.title) === normCurrent));
            const targetIds = Array.from(new Set([current.id, ...sameTitleComics.map((c) => c.id)]));
            const sourceTitles = await tx.sourceTitle.findMany({
                where: { comicId: { in: targetIds } },
                select: { id: true, sourceId: true, externalId: true, comicId: true },
            });
            if (sourceTitles.length > 0) {
                await tx.sourceTitle.deleteMany({ where: { id: { in: sourceTitles.map((st) => st.id) } } });
                for (const st of sourceTitles) {
                    await tx.auditLog.create({
                        data: {
                            actorId: actor,
                            action: "source.title.detach_on_comic_delete",
                            resource: "SourceTitle",
                            resourceId: st.id,
                            meta: { sourceId: st.sourceId, externalId: st.externalId, comicId: st.comicId ?? id },
                        },
                    });
                }
            }
            const now = new Date();
            await tx.chapter.updateMany({
                where: { comicId: { in: targetIds }, deletedAt: null },
                data: { deletedAt: now, publishState: "ARCHIVED" },
            });
            const targetRows = sameTitleComics.length ? sameTitleComics : [{ id: current.id, title: current.title, slug: current.slug }];
            for (const row of targetRows) {
                const archivedSlug = row.slug.includes("-deleted-")
                    ? row.slug
                    : `${row.slug.slice(0, 160)}-deleted-${row.id.slice(-8)}-${Date.now().toString(36)}`;
                await tx.comic.update({
                    where: { id: row.id },
                    data: {
                        deletedAt: now,
                        publishState: "ARCHIVED",
                        slug: archivedSlug,
                    },
                });
                await tx.auditLog.create({
                    data: { actorId: actor, action: "comic.delete", resource: "Comic", resourceId: row.id },
                });
            }
        });
        await this.invalidateHomeCaches();
    }
};
exports.ComicsService = ComicsService;
exports.ComicsService = ComicsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object, typeof (_b = typeof cache_service_1.CacheService !== "undefined" && cache_service_1.CacheService) === "function" ? _b : Object, typeof (_c = typeof storage_service_1.StorageService !== "undefined" && storage_service_1.StorageService) === "function" ? _c : Object])
], ComicsService);
