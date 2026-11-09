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
exports.ChaptersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const notifications_service_1 = require("../notifications/notifications.service");
const prisma_service_1 = require("../prisma/prisma.service");
const sources_service_1 = require("../sources/sources.service");
const storage_service_1 = require("../storage/storage.service");
const LIVE = {
    publishState: "PUBLISHED", deletedAt: null,
    comic: { publishState: "PUBLISHED", deletedAt: null, OR: [{ sourceTitle: { is: null } }, { sourceTitle: { is: { state: "APPROVED" } } }] },
};
let ChaptersService = class ChaptersService {
    db;
    storage;
    notes;
    sources;
    constructor(db, storage, notes, sources) {
        this.db = db;
        this.storage = storage;
        this.notes = notes;
        this.sources = sources;
    }
    async meta(id) {
        const ch = await this.db.chapter.findFirst({ where: { id, ...LIVE }, include: {
                comic: { select: { id: true, slug: true, title: true } },
                sourceChapter: { include: { sourceTitle: { select: { state: true, sourceId: true, externalId: true } } } },
                _count: { select: { images: true } },
            } });
        if (!ch || (ch.sourceChapter && ch.sourceChapter.sourceTitle.state !== "APPROVED"))
            throw new common_1.NotFoundException("Chapter not found.");
        const near = (cmp) => this.db.chapter.findFirst({
            where: { comicId: ch.comicId, publishState: "PUBLISHED", deletedAt: null, number: { [cmp]: ch.number } },
            orderBy: { number: cmp === "lt" ? "desc" : "asc" }, select: { id: true, number: true, sourceChapter: { select: { numberLabel: true } } }
        });
        const [prev, next] = await Promise.all([near("lt"), near("gt")]);
        const nav = (entry) => entry ? { id: entry.id, number: entry.number, displayNumber: entry.sourceChapter ? entry.sourceChapter.numberLabel ?? "Special" : String(entry.number) } : null;
        let external = ch.sourceChapter ? {
            sourceId: ch.sourceChapter.sourceTitle.sourceId,
            mangaId: ch.sourceChapter.sourceTitle.externalId,
            chapterId: ch.sourceChapter.externalId,
            sourceUrl: ch.sourceChapter.sourceUrl,
            groups: ch.sourceChapter.groups,
            readerUrl: `/sources/${encodeURIComponent(ch.sourceChapter.sourceTitle.sourceId)}/${encodeURIComponent(ch.sourceChapter.sourceTitle.externalId)}/read/${encodeURIComponent(ch.sourceChapter.externalId)}?lang=${encodeURIComponent(ch.sourceChapter.language ?? "en")}`,
        } : undefined;
        let alternatives = [];
        if (ch.sourceChapter && ch.sourceChapter.sourceTitle.sourceId === "comick") {
            const resolved = await this.sources.resolveAlternativeForComicChapter(ch.id);
            if (resolved.external) {
                external = resolved.external;
            }
            alternatives = resolved.alternatives;
        }
        return {
            id: ch.id, number: ch.number, displayNumber: ch.sourceChapter ? ch.sourceChapter.numberLabel ?? "Special" : String(ch.number), title: ch.title,
            comic: ch.comic, imageCount: ch.sourceChapter?.pageCount ?? ch._count.images, prev: nav(prev), next: nav(next),
            ...(external && { external }),
            ...(alternatives.length > 0 && { alternatives }),
        };
    }
    // Images are served in small batches so the reader never loads a whole chapter at once.
    async images(id, from, limit) {
        const chapter = await this.db.chapter.findFirst({ where: { id, ...LIVE }, include: { sourceChapter: true } });
        if (!chapter)
            throw new common_1.NotFoundException("Chapter not found.");
        if (chapter.sourceChapter) {
            const sourcePages = await this.sources.publishedChapterPages(id, from, limit);
            if (!sourcePages)
                throw new common_1.NotFoundException("Chapter not found.");
            return sourcePages;
        }
        const [total, rows] = await this.db.$transaction([
            this.db.chapterImage.count({ where: { chapterId: id } }),
            this.db.chapterImage.findMany({ where: { chapterId: id }, orderBy: { position: "asc" }, skip: from, take: limit }),
        ]);
        const items = await Promise.all(rows.map(async (r) => ({ id: r.id, position: r.position, width: r.width, height: r.height, url: await this.storage.readUrl(r.storageKey) })));
        return { total, from, items };
    }
    async create(dto, actorId) {
        const comic = await this.db.comic.findFirst({ where: { id: dto.comicId, deletedAt: null }, select: { id: true } });
        if (!comic)
            throw new common_1.NotFoundException("Comic not found.");
        return this.db.$transaction(async (tx) => {
            const ch = await tx.chapter.create({ data: { ...dto, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
                    publishedAt: dto.publishState === "PUBLISHED" ? new Date() : undefined } });
            if (ch.publishState === "PUBLISHED")
                await tx.comic.update({ where: { id: comic.id }, data: { updatedAt: new Date() } });
            await tx.auditLog.create({ data: { actorId, action: "chapter.create", resource: "Chapter", resourceId: ch.id } });
            return ch;
        });
    }
    async update(id, dto, actorId) {
        const { ch, publishing } = await this.db.$transaction(async (tx) => {
            const cur = await tx.chapter.findFirst({ where: { id, deletedAt: null } });
            if (!cur)
                throw new common_1.NotFoundException("Chapter not found.");
            const publishing = dto.publishState === "PUBLISHED" && cur.publishState !== "PUBLISHED";
            if (publishing && (await tx.chapterImage.count({ where: { chapterId: id } })) === 0)
                throw new common_1.BadRequestException("Add at least one image before publishing.");
            const ch = await tx.chapter.update({ where: { id }, data: { ...dto, scheduledAt: dto.scheduledAt === null ? null : dto.scheduledAt ? new Date(dto.scheduledAt) : undefined, ...(publishing && { publishedAt: new Date() }) } });
            if (publishing)
                await tx.comic.update({ where: { id: cur.comicId }, data: { updatedAt: new Date() } });
            await tx.auditLog.create({ data: { actorId, action: "chapter.update", resource: "Chapter", resourceId: id, meta: { fields: Object.keys(dto) } } });
            return { ch, publishing };
        });
        if (publishing)
            void this.notes.notifyNewChapter(ch.comicId, ch.id).catch(() => undefined); // runs after the response path, in batches
        return ch;
    }
    async uploadUrl(dto) {
        if (!(await this.db.chapter.findFirst({ where: { id: dto.chapterId, deletedAt: null }, select: { id: true } })))
            throw new common_1.NotFoundException("Chapter not found.");
        const key = `chapters/${dto.chapterId}/${(0, crypto_1.randomUUID)()}.${storage_service_1.IMAGE_TYPES[dto.contentType]}`; // server-chosen name
        return { key, uploadUrl: await this.storage.presignPut(key, dto.contentType), expiresInSeconds: 600 };
    }
    async registerImages(chapterId, dto, actorId) {
        if (!(await this.db.chapter.findFirst({ where: { id: chapterId, deletedAt: null }, select: { id: true } })))
            throw new common_1.NotFoundException("Chapter not found.");
        const prefix = `chapters/${chapterId}/`;
        const checked = [];
        for (const it of dto.items) {
            if (!it.key.startsWith(prefix) || it.key.includes(".."))
                throw new common_1.BadRequestException("Invalid image key.");
            checked.push({ ...it, ...(await this.storage.inspect(it.key)) }); // server-measured size overrides client values
        }
        try {
            return await this.db.$transaction(async (tx) => {
                let pos = ((await tx.chapterImage.aggregate({ where: { chapterId }, _max: { position: true } }))._max.position ?? -1) + 1;
                const out = [];
                for (const c of checked)
                    out.push(await tx.chapterImage.create({ data: { chapterId, position: pos++, storageKey: c.key, width: c.width, height: c.height, sha256: c.sha256 }, select: { id: true, position: true } }));
                await tx.auditLog.create({ data: { actorId, action: "chapter.images.add", resource: "Chapter", resourceId: chapterId, meta: { count: out.length } } });
                return out;
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002")
                throw new common_1.ConflictException("One of these images is already in this chapter.");
            throw e;
        }
    }
    async reorder(chapterId, ids, actorId) {
        const existing = await this.db.chapterImage.findMany({ where: { chapterId }, select: { id: true } });
        if (existing.length !== ids.length || new Set(ids).size !== ids.length || !existing.every((e) => ids.includes(e.id)))
            throw new common_1.BadRequestException("The list must contain every image in this chapter exactly once.");
        await this.db.$transaction([
            ...ids.map((id, i) => this.db.chapterImage.update({ where: { id }, data: { position: 100000 + i } })), // avoid unique clashes
            ...ids.map((id, i) => this.db.chapterImage.update({ where: { id }, data: { position: i } })),
            this.db.auditLog.create({ data: { actorId, action: "chapter.images.reorder", resource: "Chapter", resourceId: chapterId } }),
        ]);
    }
};
exports.ChaptersService = ChaptersService;
exports.ChaptersService = ChaptersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, storage_service_1.StorageService, notifications_service_1.NotificationsService, sources_service_1.SourcesService])
], ChaptersService);
//# sourceMappingURL=chapters.service.js.map