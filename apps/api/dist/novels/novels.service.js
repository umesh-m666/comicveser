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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelsModule = exports.NovelsController = exports.NovelsService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/auth.guard");
const util_1 = require("../common/util");
const novel_dto_1 = require("./dto/novel.dto");
const LIVE = { publishState: "PUBLISHED", deletedAt: null };
const PUB = { publishState: "PUBLISHED" };
let NovelsService = class NovelsService {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(q) {
        const where = { ...LIVE, ...(q.q && { title: { contains: q.q, mode: "insensitive" } }) };
        const [total, rows] = await Promise.all([
            this.db.novel.count({ where }),
            this.db.novel.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (q.page - 1) * 12, take: 12,
                select: { id: true, slug: true, title: true, author: true, genres: true, status: true, _count: { select: { chapters: { where: PUB } } } } }),
        ]);
        return { total, page: q.page, pages: Math.max(1, Math.ceil(total / 12)), items: rows.map(({ _count, ...n }) => ({ ...n, chapterCount: _count.chapters })) };
    }
    async bySlug(slug) {
        const n = await this.db.novel.findFirst({ where: { slug, ...LIVE }, include: { chapters: { where: PUB, orderBy: { number: "asc" }, select: { id: true, number: true, title: true, publishedAt: true } } } });
        if (!n)
            throw new common_1.NotFoundException("Novel not found.");
        return n;
    }
    async chapter(slug, id) {
        const ch = await this.db.novelChapter.findFirst({ where: { id, ...PUB, novel: { slug, ...LIVE } }, include: { novel: { select: { id: true, slug: true, title: true } } } });
        if (!ch)
            throw new common_1.NotFoundException("Chapter not found.");
        const near = (cmp) => this.db.novelChapter.findFirst({ where: { novelId: ch.novelId, ...PUB, number: { [cmp]: ch.number } }, orderBy: { number: cmp === "lt" ? "desc" : "asc" }, select: { id: true, number: true } });
        const [prev, next] = await Promise.all([near("lt"), near("gt")]);
        return { id: ch.id, number: ch.number, title: ch.title, body: ch.body, novel: ch.novel, prev, next };
    }
    adminList() { return this.db.novel.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { chapters: true } } } }); }
    async adminOne(id) {
        const n = await this.db.novel.findFirst({ where: { id, deletedAt: null }, include: { chapters: { orderBy: { number: "desc" }, select: { id: true, number: true, title: true, publishState: true } } } });
        if (!n)
            throw new common_1.NotFoundException("Novel not found.");
        return n;
    }
    async slug(title) {
        const base = (0, util_1.slugify)(title) || "novel";
        for (let i = 0;; i++) {
            const s = i ? `${base}-${i + 1}` : base;
            if (!(await this.db.novel.findUnique({ where: { slug: s }, select: { id: true } })))
                return s;
        }
    }
    async create(d, actorId) {
        const slug = await this.slug(d.title);
        return this.db.$transaction(async (tx) => {
            const n = await tx.novel.create({ data: { ...d, slug } });
            await tx.auditLog.create({ data: { actorId, action: "novel.create", resource: "Novel", resourceId: n.id } });
            return n;
        });
    }
    async update(id, d, actorId) {
        return this.db.$transaction(async (tx) => {
            if (!(await tx.novel.findFirst({ where: { id, deletedAt: null }, select: { id: true } })))
                throw new common_1.NotFoundException("Novel not found.");
            const n = await tx.novel.update({ where: { id }, data: d });
            await tx.auditLog.create({ data: { actorId, action: "novel.update", resource: "Novel", resourceId: id } });
            return n;
        });
    }
    async addChapter(novelId, d, actorId) {
        if (!(await this.db.novel.findFirst({ where: { id: novelId, deletedAt: null }, select: { id: true } })))
            throw new common_1.NotFoundException("Novel not found.");
        return this.db.$transaction(async (tx) => {
            const c = await tx.novelChapter.create({ data: { ...d, novelId, publishedAt: d.publishState === "PUBLISHED" ? new Date() : undefined }, select: { id: true } });
            if (d.publishState === "PUBLISHED")
                await tx.novel.update({ where: { id: novelId }, data: { updatedAt: new Date() } });
            await tx.auditLog.create({ data: { actorId, action: "novel.chapter.create", resource: "NovelChapter", resourceId: c.id } });
            return c;
        });
    }
    async updateChapter(id, d, actorId) {
        return this.db.$transaction(async (tx) => {
            const cur = await tx.novelChapter.findUnique({ where: { id } });
            if (!cur)
                throw new common_1.NotFoundException("Chapter not found.");
            const publishing = d.publishState === "PUBLISHED" && cur.publishState !== "PUBLISHED";
            await tx.novelChapter.update({ where: { id }, data: { ...d, ...(publishing && { publishedAt: new Date() }) } });
            if (publishing)
                await tx.novel.update({ where: { id: cur.novelId }, data: { updatedAt: new Date() } });
            await tx.auditLog.create({ data: { actorId, action: "novel.chapter.update", resource: "NovelChapter", resourceId: id } });
        });
    }
};
exports.NovelsService = NovelsService;
exports.NovelsService = NovelsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NovelsService);
let NovelsController = class NovelsController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    list(q) { return this.svc.list(q); }
    one(s) { return this.svc.bySlug(s); }
    chapter(s, id) { return this.svc.chapter(s, id); }
    adminList() { return this.svc.adminList(); }
    adminOne(id) { return this.svc.adminOne(id); }
    create(u, d) { return this.svc.create(d, u.id); }
    update(u, id, d) { return this.svc.update(id, d, u.id); }
    addChapter(u, id, d) { return this.svc.addChapter(id, d, u.id); }
    updateChapter(u, id, d) { return this.svc.updateChapter(id, d, u.id); }
};
exports.NovelsController = NovelsController;
__decorate([
    (0, common_1.Get)("novels"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [novel_dto_1.NovelListQuery]),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)("novels/:slug"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "one", null);
__decorate([
    (0, common_1.Get)("novels/:slug/chapters/:id"),
    __param(0, (0, common_1.Param)("slug")),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "chapter", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Get)("admin/novels"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "adminList", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Get)("admin/novels/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "adminOne", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Post)("admin/novels"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, novel_dto_1.CreateNovelDto]),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "create", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Put)("admin/novels/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, novel_dto_1.UpdateNovelDto]),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "update", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Post)("admin/novels/:id/chapters"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, novel_dto_1.CreateNovelChapterDto]),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "addChapter", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Put)("admin/novel-chapters/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, novel_dto_1.UpdateNovelChapterDto]),
    __metadata("design:returntype", void 0)
], NovelsController.prototype, "updateChapter", null);
exports.NovelsController = NovelsController = __decorate([
    (0, swagger_1.ApiTags)("novels"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [NovelsService])
], NovelsController);
let NovelsModule = class NovelsModule {
};
exports.NovelsModule = NovelsModule;
exports.NovelsModule = NovelsModule = __decorate([
    (0, common_1.Module)({ controllers: [NovelsController], providers: [NovelsService] })
], NovelsModule);
//# sourceMappingURL=novels.service.js.map