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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComicsService = void 0;
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../cache/cache.service");
const prisma_service_1 = require("../prisma/prisma.service");
const util_1 = require("../common/util");
const storage_service_1 = require("../storage/storage.service");
const crypto_1 = require("crypto");
const PUBLIC = {
    publishState: "PUBLISHED", deletedAt: null,
    OR: [{ sourceTitle: { is: null } }, { sourceTitle: { is: { state: "APPROVED" } } }],
};
const include = { genres: { include: { genre: true } } };
let ComicsService = class ComicsService {
    db;
    cache;
    storage;
    constructor(db, cache, storage) {
        this.db = db;
        this.cache = cache;
        this.storage = storage;
    }
    mediaUrl(key) { return key ? this.storage.readUrl(key) : Promise.resolve(null); }
    // Average comes from Rating rows only; it is never stored on the comic.
    async withRatings(items) {
        const g = await this.db.rating.groupBy({ by: ["comicId"], where: { comicId: { in: items.map((i) => i.id) } }, _avg: { value: true }, _count: true });
        const m = new Map(g.map((r) => [r.comicId, r]));
        const latest = await this.db.chapter.findMany({
            where: { comicId: { in: items.map((i) => i.id) }, publishState: "PUBLISHED", deletedAt: null },
            orderBy: [{ comicId: "asc" }, { number: "desc" }], distinct: ["comicId"],
            select: { id: true, comicId: true, number: true, publishedAt: true, sourceChapter: { select: { numberLabel: true } } },
        });
        const lm = new Map(latest.map((c) => [c.comicId, c]));
        return Promise.all(items.map(async (i) => {
            const latestChapter = lm.get(i.id);
            return {
                ...i, rating: m.get(i.id)?._avg.value ?? null, ratingCount: m.get(i.id)?._count ?? 0,
                latestChapter: latestChapter ? { id: latestChapter.id, number: latestChapter.number, displayNumber: latestChapter.sourceChapter ? latestChapter.sourceChapter.numberLabel ?? "Special" : String(latestChapter.number), publishedAt: latestChapter.publishedAt } : null,
                coverUrl: i.externalCoverUrl ?? await this.mediaUrl(i.coverKey),
                bannerUrl: await this.mediaUrl(i.bannerKey),
            };
        }));
    }
    async list(q) {
        const where = {
            ...PUBLIC,
            ...(q.q && { OR: [
                    { title: { contains: q.q, mode: "insensitive" } }, { altTitle: { contains: q.q, mode: "insensitive" } },
                    { author: { contains: q.q, mode: "insensitive" } }, { artist: { contains: q.q, mode: "insensitive" } },
                ] }),
            ...(q.genre && { genres: { some: { genre: { slug: q.genre } } } }),
            ...(q.type && { type: q.type }), ...(q.status && { status: q.status }), ...(q.year && { releaseYear: q.year }),
        };
        const orderBy = { updated: { updatedAt: "desc" }, added: { createdAt: "desc" }, popular: { views: "desc" }, alpha: { title: "asc" } }[q.sort ?? "updated"];
        const [total, rows] = await this.db.$transaction([
            this.db.comic.count({ where }),
            this.db.comic.findMany({ where, orderBy, include, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
        ]);
        let items = await this.withRatings(rows);
        if (q.minRating)
            items = items.filter((i) => (i.rating ?? 0) >= q.minRating); // note: filters within page; moves to SQL in Phase 7
        return { items, total, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(total / q.pageSize)) };
    }
    async top(orderBy, take = 12) {
        return this.withRatings(await this.db.comic.findMany({ where: PUBLIC, orderBy, include, take }));
    }
    trending() { return this.cache.wrap("comics:trending", 60, () => this.top({ views: "desc" })); }
    popular() { return this.cache.wrap("comics:popular", 60, () => this.top({ views: "desc" })); }
    latest() { return this.cache.wrap("comics:latest", 60, () => this.top({ updatedAt: "desc" })); }
    async bySlug(slug) {
        const c = await this.db.comic.findFirst({ where: { slug, ...PUBLIC }, include });
        if (!c)
            throw new common_1.NotFoundException("Comic not found.");
        const [withRating] = await this.withRatings([c]);
        const chapterCount = await this.db.chapter.count({ where: { comicId: c.id, publishState: "PUBLISHED", deletedAt: null } });
        return { ...withRating, chapterCount };
    }
    async chapters(comicId, order = "desc") {
        const comic = await this.db.comic.findFirst({ where: { id: comicId, ...PUBLIC }, select: { id: true } });
        if (!comic)
            throw new common_1.NotFoundException("Comic not found.");
        const rows = await this.db.chapter.findMany({
            where: { comicId, publishState: "PUBLISHED", deletedAt: null }, orderBy: { number: order },
            select: { id: true, number: true, title: true, publishedAt: true, sourceChapter: { select: { numberLabel: true } } },
        });
        return rows.map(({ sourceChapter, ...chapter }) => ({ ...chapter, displayNumber: sourceChapter ? sourceChapter.numberLabel ?? "Special" : String(chapter.number) }));
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
        return this.db.$transaction(async (tx) => {
            const comic = await tx.comic.create({ data: { ...data, slug, genres: { create: genres } }, include });
            await tx.auditLog.create({ data: { actorId: actor, action: "comic.create", resource: "Comic", resourceId: comic.id } });
            return comic;
        });
    }
    async update(id, dto, actor) {
        await this.validateCoverKey(dto.coverKey);
        await this.validateCoverKey(dto.bannerKey);
        const { genreSlugs, ...data } = dto;
        const genres = genreSlugs ? await this.genreConnect(genreSlugs) : undefined;
        return this.db.$transaction(async (tx) => {
            const exists = await tx.comic.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
            if (!exists)
                throw new common_1.NotFoundException("Comic not found.");
            if (genres)
                await tx.comicGenre.deleteMany({ where: { comicId: id } });
            const comic = await tx.comic.update({ where: { id }, data: { ...data, ...(genres && { genres: { create: genres } }) }, include });
            await tx.auditLog.create({ data: { actorId: actor, action: "comic.update", resource: "Comic", resourceId: id, meta: { fields: Object.keys(dto) } } });
            return comic;
        });
    }
    async remove(id, actor) {
        await this.db.$transaction(async (tx) => {
            // Verify the comic first. A source-backed comic has a unique SourceTitle row;
            // leaving that row attached after a soft delete makes the next provider
            // approval think the title is still published. Remove the source mapping
            // in the same transaction. SourceChapter mappings cascade from SourceTitle,
            // while the archived Comic/Chapter history remains available for auditing.
            const current = await tx.comic.findFirst({
                where: { id, deletedAt: null },
                select: { id: true },
            });
            if (!current)
                throw new common_1.NotFoundException("Comic not found.");
            const sourceTitle = await tx.sourceTitle.findUnique({
                where: { comicId: id },
                select: { id: true, sourceId: true, externalId: true },
            });
            if (sourceTitle) {
                await tx.sourceTitle.delete({ where: { id: sourceTitle.id } });
                await tx.auditLog.create({ data: {
                        actorId: actor,
                        action: "source.title.detach_on_comic_delete",
                        resource: "SourceTitle",
                        resourceId: sourceTitle.id,
                        meta: { sourceId: sourceTitle.sourceId, externalId: sourceTitle.externalId, comicId: id },
                    } });
            }
            await tx.comic.update({
                where: { id },
                data: { deletedAt: new Date(), publishState: "ARCHIVED" },
            });
            await tx.auditLog.create({ data: { actorId: actor, action: "comic.delete", resource: "Comic", resourceId: id } });
        });
        // The home-page lists are cached independently of the database queries.
        await Promise.all(["comics:trending", "comics:popular", "comics:latest"].map((key) => this.cache.delete(key)));
    }
};
exports.ComicsService = ComicsService;
exports.ComicsService = ComicsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, cache_service_1.CacheService, storage_service_1.StorageService])
], ComicsService);
//# sourceMappingURL=comics.service.js.map