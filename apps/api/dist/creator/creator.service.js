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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorModule = exports.CreatorController = exports.CreatorService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/auth.guard");
const comics_module_1 = require("../comics/comics.module");
const comics_service_1 = require("../comics/comics.service");
const chapters_module_1 = require("../chapters/chapters.module");
const chapters_service_1 = require("../chapters/chapters.service");
const admin_module_1 = require("../admin/admin.module");
const admin_service_1 = require("../admin/admin.service");
const chapter_dto_1 = require("../chapters/dto/chapter.dto");
const creator_dto_1 = require("./dto/creator.dto");
let CreatorService = class CreatorService {
    db;
    comics;
    chapters;
    admin;
    constructor(db, comics, chapters, admin) {
        this.db = db;
        this.comics = comics;
        this.chapters = chapters;
        this.admin = admin;
    }
    me(userId) { return this.db.creator.findUnique({ where: { userId }, select: { id: true, displayName: true, status: true } }); }
    async apply(userId, displayName) {
        try {
            await this.db.creator.create({ data: { userId, displayName } });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002")
                throw new common_1.ConflictException("You have already applied.");
            throw e;
        }
    }
    async approved(userId) {
        const c = await this.db.creator.findUnique({ where: { userId } });
        if (!c)
            throw new common_1.ForbiddenException("Apply to become a creator first.");
        if (c.status !== "APPROVED")
            throw new common_1.ForbiddenException(`Your creator account is ${c.status.toLowerCase()}.`);
        return c;
    }
    async owns(userId, comicId) {
        const c = await this.approved(userId);
        if (!(await this.db.creatorComic.findUnique({ where: { creatorId_comicId: { creatorId: c.id, comicId } } })))
            throw new common_1.NotFoundException("Comic not found.");
    }
    async ownChapter(userId, id, mutate = false) {
        const ch = await this.db.chapter.findFirst({ where: { id, deletedAt: null }, select: { id: true, comicId: true, publishState: true } });
        if (!ch)
            throw new common_1.NotFoundException("Chapter not found.");
        await this.owns(userId, ch.comicId);
        if (mutate && ch.publishState === "PUBLISHED")
            throw new common_1.ForbiddenException("Published chapters can only be changed by an admin.");
        return ch;
    }
    async myComics(userId) {
        const c = await this.approved(userId);
        return this.db.comic.findMany({ where: { deletedAt: null, creators: { some: { creatorId: c.id } } }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, publishState: true, _count: { select: { chapters: true } } } });
    }
    async submitComic(userId, dto) {
        const creator = await this.approved(userId);
        const { genreSlugs, licenseHolder, licenseType, territory, ...data } = dto;
        const genres = await this.comics.genreConnect(genreSlugs);
        const slug = await this.comics.uniqueSlug(dto.title);
        return this.db.$transaction(async (tx) => {
            const comic = await tx.comic.create({ data: { ...data, slug, publishState: "PENDING", genres: { create: genres },
                    creators: { create: { creatorId: creator.id } }, licenses: { create: { holder: licenseHolder, licenseType, territory } } }, select: { id: true } });
            await tx.auditLog.create({ data: { actorId: userId, action: "creator.comic.submit", resource: "Comic", resourceId: comic.id } });
            return comic;
        });
    }
    async comicChapters(userId, comicId) { await this.owns(userId, comicId); return this.admin.chapters(comicId); }
    async createChapter(userId, comicId, d) { await this.owns(userId, comicId); return this.chapters.create({ ...d, comicId, publishState: "DRAFT" }, userId); }
    async chapter(userId, id) { await this.ownChapter(userId, id); return this.admin.chapter(id); }
    async uploadUrl(userId, d) { await this.ownChapter(userId, d.chapterId, true); return this.chapters.uploadUrl(d); }
    async comicCoverUploadUrl(userId, contentType, size) { await this.approved(userId); return this.comics.coverUploadUrl(contentType, size); }
    async register(userId, id, d) { await this.ownChapter(userId, id, true); return this.chapters.registerImages(id, d, userId); }
    async reorder(userId, id, ids) { await this.ownChapter(userId, id, true); return this.chapters.reorder(id, ids, userId); }
    async deleteImage(userId, id, imageId) { await this.ownChapter(userId, id, true); return this.admin.deleteImage(id, imageId, userId); }
    async submitChapter(userId, id) {
        await this.ownChapter(userId, id, true);
        await this.db.$transaction(async (tx) => {
            if (!(await tx.chapterImage.count({ where: { chapterId: id } })))
                throw new common_1.ForbiddenException("Add at least one page before submitting.");
            await tx.chapter.update({ where: { id }, data: { publishState: "PENDING" } });
            await tx.auditLog.create({ data: { actorId: userId, action: "creator.chapter.submit", resource: "Chapter", resourceId: id } });
        });
    }
};
exports.CreatorService = CreatorService;
exports.CreatorService = CreatorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object, typeof (_b = typeof comics_service_1.ComicsService !== "undefined" && comics_service_1.ComicsService) === "function" ? _b : Object, typeof (_c = typeof chapters_service_1.ChaptersService !== "undefined" && chapters_service_1.ChaptersService) === "function" ? _c : Object, typeof (_d = typeof admin_service_1.AdminService !== "undefined" && admin_service_1.AdminService) === "function" ? _d : Object])
], CreatorService);
let CreatorController = class CreatorController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    async me(u) { return (await this.svc.me(u.id)) ?? { status: "NONE" }; }
    apply(u, d) { return this.svc.apply(u.id, d.displayName); }
    comics(u) { return this.svc.myComics(u.id); }
    coverUpload(u, d) { return this.svc.comicCoverUploadUrl(u.id, d.contentType, d.size); }
    submit(u, d) { return this.svc.submitComic(u.id, d); }
    chapters(u, id) { return this.svc.comicChapters(u.id, id); }
    create(u, id, d) { return this.svc.createChapter(u.id, id, d); }
    chapter(u, id) { return this.svc.chapter(u.id, id); }
    upload(u, d) { return this.svc.uploadUrl(u.id, d); }
    register(u, id, d) { return this.svc.register(u.id, id, d); }
    reorder(u, id, d) { return this.svc.reorder(u.id, id, d.ids); }
    del(u, id, i) { return this.svc.deleteImage(u.id, id, i); }
    submitChapter(u, id) { return this.svc.submitChapter(u.id, id); }
};
exports.CreatorController = CreatorController;
__decorate([
    (0, common_1.Get)("me"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], CreatorController.prototype, "me", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("apply"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _f : Object, typeof (_g = typeof creator_dto_1.ApplyDto !== "undefined" && creator_dto_1.ApplyDto) === "function" ? _g : Object]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "apply", null);
__decorate([
    (0, common_1.Get)("comics"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _h : Object]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "comics", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("comic-uploads"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_j = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _j : Object, Object]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "coverUpload", null);
__decorate([
    (0, common_1.Post)("comics"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _k : Object, typeof (_l = typeof creator_dto_1.CreatorComicDto !== "undefined" && creator_dto_1.CreatorComicDto) === "function" ? _l : Object]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)("comics/:id/chapters"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_m = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _m : Object, String]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "chapters", null);
__decorate([
    (0, common_1.Post)("comics/:id/chapters"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_o = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _o : Object, String, typeof (_p = typeof creator_dto_1.CreatorChapterDto !== "undefined" && creator_dto_1.CreatorChapterDto) === "function" ? _p : Object]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "create", null);
__decorate([
    (0, common_1.Get)("chapters/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_q = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _q : Object, String]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "chapter", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("uploads"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_r = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _r : Object, typeof (_s = typeof chapter_dto_1.UploadUrlDto !== "undefined" && chapter_dto_1.UploadUrlDto) === "function" ? _s : Object]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)("chapters/:id/images"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_t = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _t : Object, String, typeof (_u = typeof chapter_dto_1.RegisterImagesDto !== "undefined" && chapter_dto_1.RegisterImagesDto) === "function" ? _u : Object]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "register", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("chapters/:id/images/order"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_v = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _v : Object, String, typeof (_w = typeof chapter_dto_1.ReorderDto !== "undefined" && chapter_dto_1.ReorderDto) === "function" ? _w : Object]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "reorder", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("chapters/:id/images/:imageId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)("imageId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_x = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _x : Object, String, String]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "del", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("chapters/:id/submit"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_y = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _y : Object, String]),
    __metadata("design:returntype", void 0)
], CreatorController.prototype, "submitChapter", null);
exports.CreatorController = CreatorController = __decorate([
    (0, swagger_1.ApiTags)("creator"),
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Controller)("creator"),
    __metadata("design:paramtypes", [CreatorService])
], CreatorController);
let CreatorModule = class CreatorModule {
};
exports.CreatorModule = CreatorModule;
exports.CreatorModule = CreatorModule = __decorate([
    (0, common_1.Module)({ imports: [comics_module_1.ComicsModule, chapters_module_1.ChaptersModule, admin_module_1.AdminModule], controllers: [CreatorController], providers: [CreatorService] })
], CreatorModule);
