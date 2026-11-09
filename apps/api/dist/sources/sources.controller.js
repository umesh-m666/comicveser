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
    __metadata("design:paramtypes", [sources_dto_1.SearchSourcesQuery]),
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
    __metadata("design:paramtypes", [String, String, sources_dto_1.ChaptersQuery]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "chapters", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Get)("sources/:sourceId/manga/:externalId/alternatives"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, sources_dto_1.ChaptersQuery]),
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
    __metadata("design:paramtypes", [String, String, String, sources_dto_1.PagesQuery]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "pages", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("user/external-library"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "library", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("user/external-library/:sourceId/:externalId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Param)("externalId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
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
    __metadata("design:paramtypes", [Object, sources_dto_1.SaveExternalDto]),
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
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "remove", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Get)("admin/sources/catalog/search"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sources_dto_1.SearchSourcesQuery]),
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
    __metadata("design:paramtypes", [String, String, sources_dto_1.ChaptersQuery]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "catalogChapters", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources/catalog/:sourceId/:externalId/alternatives"),
    __param(0, (0, common_1.Param)(SOURCE)),
    __param(1, (0, common_1.Param)("externalId")),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, sources_dto_1.ChaptersQuery]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "catalogAlternatives", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/sources/comics/:id/chapters"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sources_dto_1.ComicChaptersQuery]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "comicChapters", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Get)("admin/sources/comics/:id/fallback-candidates"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sources_dto_1.FallbackCandidatesQuery]),
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
    __metadata("design:paramtypes", [Object, String, sources_dto_1.LinkFallbackDto]),
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
    __metadata("design:paramtypes", [Object, String, String]),
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
    __metadata("design:paramtypes", [Object, String, sources_dto_1.ImportAlternativeChaptersDto]),
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
    __metadata("design:paramtypes", [Object, String, String, sources_dto_1.SourceTitleActionDto]),
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
    __metadata("design:paramtypes", [Object, String, String, sources_dto_1.SourceTitleActionDto]),
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
    __metadata("design:paramtypes", [Object, String, String]),
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
    __metadata("design:paramtypes", [Object, String, String]),
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
    __metadata("design:paramtypes", [Object, String, String, sources_dto_1.ChaptersQuery, sources_dto_1.ImportChaptersBodyDto]),
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
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("admin/sources/:sourceId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)(SOURCE)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sources_dto_1.UpdateSourceDto]),
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
    __metadata("design:paramtypes", [sources_service_1.SourcesService])
], SourcesController);
//# sourceMappingURL=sources.controller.js.map