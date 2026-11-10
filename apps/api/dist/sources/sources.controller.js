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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourcesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const auth_guard_1 = require("../auth/auth.guard");
const sources_dto_1 = require("./sources.dto");
const sources_service_1 = require("./sources.service");
const SOURCE = "sourceId";
let SourcesController = class SourcesController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    list() { return this.svc.list(); }
    // Declared before :sourceId so "search" is not read as a source id.
    search(q) { const { source, ...rest } = q; return this.svc.search(source, rest); }
    one(id) { return this.svc.one(id); }
    health(id) { return this.svc.health(id); }
    /** Providers may opt into cover proxying; the current providers return direct cover URLs. */
    async cover(id, mangaId, file, res) {
        const { body, contentType } = await this.svc.cover(id, mangaId, file);
        this.sendCover(res, body, contentType);
    }
    details(id, ext) { return this.svc.details(id, ext); }
    chapters(id, ext, q) { return this.svc.chapters(id, ext, q); }
    alternatives(id, ext, q) { return this.svc.publicAlternatives(id, ext, q.language); }
    pages(id, externalId, chapterId, q) { return this.svc.publicPages(id, externalId, chapterId, q.quality); }
    // ---- saved titles
    library(u) { return this.svc.library(u.id); }
    isSaved(u, s, e) { return this.svc.isSaved(u.id, s, e); }
    save(u, d) { return this.svc.save(u.id, d.sourceId, d.externalId); }
    async remove(u, s, e) { await this.svc.remove(u.id, s, e); }
    // ---- admin
    catalogSearch(q) { const { source, ...rest } = q; return this.svc.adminSearch(source, rest); }
    catalogDetails(id, ext) { return this.svc.adminDetails(id, ext); }
    catalogChapters(id, ext, q) { return this.svc.adminChapters(id, ext, q); }
    catalogAlternatives(id, ext, q) { return this.svc.adminAlternatives(id, ext, q.language); }
    // ---- admin fallback management & chapter catalogue routes
    comicChapters(comicId, q) { return this.svc.adminComicChapters(comicId, q); }
    fallbackCandidates(comicId, q) { return this.svc.adminFallbackCandidates(comicId, q); }
    linkFallback(u, comicId, d) { return this.svc.linkFallbackSource(comicId, d, u.id); }
    async unlinkFallback(u, comicId, sourceId) { await this.svc.unlinkFallbackSource(comicId, sourceId, u.id); }
    importAlternativeChapters(u, comicId, d) {
        return this.svc.importAlternativeChaptersForComic(comicId, d.sourceId, d.externalId, { language: d.language ?? "en", page: d.page ?? 1, limit: d.limit ?? 500 }, u.id);
    }
    approve(u, id, ext, d) {
        return this.svc.approve(id, ext, d.language ?? "en", u.id, { chapterSourceId: d.chapterSourceId, chapterExternalId: d.chapterExternalId });
    }
    reject(u, id, ext, d) { return this.svc.reject(id, ext, d.note, u.id); }
    unpublish(u, id, ext) { return this.svc.unpublish(id, ext, u.id); }
    republish(u, id, ext) { return this.svc.republish(id, ext, u.id); }
    importChapters(u, id, ext, q, body) {
        return this.svc.importChapterPage(id, ext, q, u.id, body?.chapterIds);
    }
    async adminCover(id, mangaId, file, res) {
        const { body, contentType } = await this.svc.adminCover(id, mangaId, file);
        this.sendCover(res, body, contentType);
    }
    adminList() { return this.svc.adminList(); }
    adminAlerts() { return this.svc.adminAlerts(); }
    syncStatus() { return this.svc.getSyncStatus(); }
    triggerSync(u, body) {
        return this.svc.runAutomaticChapterSync({ comicId: body?.comicId, actorId: u.id });
    }
    repairComicChapters(u, comicId) {
        return this.svc.synchronizeAndRepairComic(comicId, u.id);
    }
    update(u, id, d) { return this.svc.updateSetting(id, d, u.id); }
    test(id) { return this.svc.test(id); }
    sendCover(res, body, contentType) {
        res.setHeader("Content-Type", contentType);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, max-age=300");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.send(body);
    }
};
exports.SourcesController = SourcesController;
__decorate([
    (0, common_1.Get)("sources"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "list", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Get)("sources/search"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof sources_dto_1.SearchSourcesQuery !== "undefined" && sources_dto_1.SearchSourcesQuery) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "search", null);
__decorate([
    (0, common_1.Get)("sources/:sourceId"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "one", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Get)("sources/:sourceId/health"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "health", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 240, ttl: 60_000 } }),
    (0, common_1.Get)("sources/:sourceId/cover/:mangaId/:file"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("mangaId")),
    __param(2, (0, common_1.Param)("file")),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "cover", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60_000 } }),
    (0, common_1.Get)("sources/:sourceId/manga/:externalId"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "details", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60_000 } }),
    (0, common_1.Get)("sources/:sourceId/manga/:externalId/chapters"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, typeof (_c = typeof sources_dto_1.ChaptersQuery !== "undefined" && sources_dto_1.ChaptersQuery) === "function" ? _c : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "chapters", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Get)("sources/:sourceId/manga/:externalId/alternatives"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, typeof (_d = typeof sources_dto_1.ChaptersQuery !== "undefined" && sources_dto_1.ChaptersQuery) === "function" ? _d : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "alternatives", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Get)("sources/:sourceId/manga/:externalId/chapters/:chapterId/pages"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __param(2, (0, common_1.Param)("chapterId")),
    __param(3, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, typeof (_e = typeof sources_dto_1.PagesQuery !== "undefined" && sources_dto_1.PagesQuery) === "function" ? _e : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "pages", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("user/external-library"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "library", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("user/external-library/:sourceId/:externalId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Param)("externalId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_g = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _g : Object, String, String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "isSaved", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("user/external-library"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _h : Object, typeof (_j = typeof sources_dto_1.SaveExternalDto !== "undefined" && sources_dto_1.SaveExternalDto) === "function" ? _j : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "save", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("user/external-library/:sourceId/:externalId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Param)("externalId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _k : Object, String, String]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "remove", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Get)("admin/sources/catalog/search"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_l = typeof sources_dto_1.SearchSourcesQuery !== "undefined" && sources_dto_1.SearchSourcesQuery) === "function" ? _l : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "catalogSearch", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources/catalog/:sourceId/:externalId"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "catalogDetails", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources/catalog/:sourceId/:externalId/chapters"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, typeof (_m = typeof sources_dto_1.ChaptersQuery !== "undefined" && sources_dto_1.ChaptersQuery) === "function" ? _m : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "catalogChapters", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources/catalog/:sourceId/:externalId/alternatives"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, typeof (_o = typeof sources_dto_1.ChaptersQuery !== "undefined" && sources_dto_1.ChaptersQuery) === "function" ? _o : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "catalogAlternatives", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources/comics/:id/chapters"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_p = typeof sources_dto_1.ComicChaptersQuery !== "undefined" && sources_dto_1.ComicChaptersQuery) === "function" ? _p : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "comicChapters", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Get)("admin/sources/comics/:id/fallback-candidates"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_q = typeof sources_dto_1.FallbackCandidatesQuery !== "undefined" && sources_dto_1.FallbackCandidatesQuery) === "function" ? _q : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "fallbackCandidates", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60_000 } }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/sources/comics/:id/fallbacks"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_r = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _r : Object, String, typeof (_s = typeof sources_dto_1.LinkFallbackDto !== "undefined" && sources_dto_1.LinkFallbackDto) === "function" ? _s : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "linkFallback", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("admin/sources/comics/:id/fallbacks/:sourceId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)(SOURCE)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_t = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _t : Object, String, String]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "unlinkFallback", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/sources/comics/:comicId/chapters/import-alternative"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_u = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _u : Object, String, typeof (_v = typeof sources_dto_1.ImportAlternativeChaptersDto !== "undefined" && sources_dto_1.ImportAlternativeChaptersDto) === "function" ? _v : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "importAlternativeChapters", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/sources/catalog/:sourceId/:externalId/approve"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Param)("externalId")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_w = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _w : Object, String, String, typeof (_x = typeof sources_dto_1.SourceTitleActionDto !== "undefined" && sources_dto_1.SourceTitleActionDto) === "function" ? _x : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "approve", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("admin/sources/catalog/:sourceId/:externalId/reject"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Param)("externalId")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_y = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _y : Object, String, String, typeof (_z = typeof sources_dto_1.SourceTitleActionDto !== "undefined" && sources_dto_1.SourceTitleActionDto) === "function" ? _z : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "reject", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("admin/sources/catalog/:sourceId/:externalId/unpublish"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Param)("externalId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_0 = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _0 : Object, String, String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "unpublish", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("admin/sources/catalog/:sourceId/:externalId/republish"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Param)("externalId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_1 = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _1 : Object, String, String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "republish", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/sources/catalog/:sourceId/:externalId/chapters/import"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Param)("externalId")),
    __param(3, (0, common_1.Query)()),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_2 = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _2 : Object, String, String, typeof (_3 = typeof sources_dto_1.ChaptersQuery !== "undefined" && sources_dto_1.ChaptersQuery) === "function" ? _3 : Object, typeof (_4 = typeof sources_dto_1.ImportChaptersBodyDto !== "undefined" && sources_dto_1.ImportChaptersBodyDto) === "function" ? _4 : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "importChapters", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 240, ttl: 60_000 } }),
    (0, common_1.Get)("admin/sources/:sourceId/cover/:mangaId/:file"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("mangaId")),
    __param(2, (0, common_1.Param)("file")),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "adminCover", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "adminList", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources/alerts"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "adminAlerts", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources/sync-status"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "syncStatus", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/sources/sync"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_5 = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _5 : Object, Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "triggerSync", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/sources/comics/:comicId/repair"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_6 = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _6 : Object, String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "repairComicChapters", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("admin/sources/:sourceId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_7 = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _7 : Object, String, typeof (_8 = typeof sources_dto_1.UpdateSourceDto !== "undefined" && sources_dto_1.UpdateSourceDto) === "function" ? _8 : Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "update", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/sources/:sourceId/test"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "test", null);
exports.SourcesController = SourcesController = __decorate([
    (0, swagger_1.ApiTags)("sources"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [typeof (_a = typeof sources_service_1.SourcesService !== "undefined" && sources_service_1.SourcesService) === "function" ? _a : Object])
], SourcesController);
