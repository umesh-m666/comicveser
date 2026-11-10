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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const admin_service_1 = require("./admin.service");
const admin_dto_1 = require("./dto/admin.dto");
let AdminController = class AdminController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    dashboard() {
        return this.svc.dashboard();
    }
    adminNotifications(u, filter, page) {
        return this.svc.adminNotifications(u.id, { filter, page: page ? Number.parseInt(page, 10) || 1 : 1 });
    }
    comics(q) {
        return this.svc.comics(q);
    }
    comic(id) {
        return this.svc.comic(id);
    }
    chapters(q) {
        return this.svc.chapters(q.comicId);
    }
    chapter(id) {
        return this.svc.chapter(id);
    }
    deleteImage(u, id, imageId) {
        return this.svc.deleteImage(id, imageId, u.id);
    }
    bulk(u, id, file) {
        return this.svc.bulkZip(id, file, u.id);
    }
    users(q) {
        return this.svc.users(q);
    }
    status(u, id, d) {
        return this.svc.setUserStatus(id, d.status, u.id);
    }
    reports(q) {
        return this.svc.reports(q);
    }
    resolve(u, id, d) {
        return this.svc.resolveReport(id, d, u.id);
    }
    audit(q) {
        return this.svc.auditLogs(q.page);
    }
    announcements() {
        return this.svc.announcements();
    }
    createAnn(u, d) {
        return this.svc.createAnnouncement(d, u.id);
    }
    deleteAnn(u, id) {
        return this.svc.deleteAnnouncement(id, u.id);
    }
    creators() {
        return this.svc.creators();
    }
    creatorStatus(u, id, d) {
        return this.svc.setCreatorStatus(id, d.status, u.id);
    }
    reviews(q) {
        return this.svc.reviews(q.page);
    }
    publicAnnouncements() {
        return this.svc.publicAnnouncements();
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, auth_guard_1.RequirePermission)("audit:read"),
    (0, common_1.Get)("admin/dashboard"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "dashboard", null);
__decorate([
    (0, auth_guard_1.RequireAdmin)(),
    (0, common_1.Get)("admin/notifications"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Query)("filter")),
    __param(2, (0, common_1.Query)("page")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _b : Object, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "adminNotifications", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Get)("admin/comics"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof admin_dto_1.AdminListQuery !== "undefined" && admin_dto_1.AdminListQuery) === "function" ? _c : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "comics", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Get)("admin/comics/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "comic", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.Get)("admin/chapters"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_d = typeof admin_dto_1.AdminListQuery !== "undefined" && admin_dto_1.AdminListQuery) === "function" ? _d : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "chapters", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.Get)("admin/chapters/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "chapter", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("admin/chapters/:id/images/:imageId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)("imageId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _e : Object, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteImage", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.Post)("admin/chapters/:id/bulk"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file", { limits: { fileSize: 100 * 1024 * 1024, files: 1 } })),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _f : Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "bulk", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("user:manage"),
    (0, common_1.Get)("admin/users"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_g = typeof admin_dto_1.AdminListQuery !== "undefined" && admin_dto_1.AdminListQuery) === "function" ? _g : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "users", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("user:manage"),
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("admin/users/:id/status"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _h : Object, String, typeof (_j = typeof admin_dto_1.SetStatusDto !== "undefined" && admin_dto_1.SetStatusDto) === "function" ? _j : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "status", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("review:moderate"),
    (0, common_1.Get)("admin/reports"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof admin_dto_1.AdminListQuery !== "undefined" && admin_dto_1.AdminListQuery) === "function" ? _k : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "reports", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("review:moderate"),
    (0, common_1.Put)("admin/reports/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_l = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _l : Object, String, typeof (_m = typeof admin_dto_1.ResolveReportDto !== "undefined" && admin_dto_1.ResolveReportDto) === "function" ? _m : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolve", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("audit:read"),
    (0, common_1.Get)("admin/audit-logs"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_o = typeof admin_dto_1.AdminListQuery !== "undefined" && admin_dto_1.AdminListQuery) === "function" ? _o : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "audit", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Get)("admin/announcements"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "announcements", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Post)("admin/announcements"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_p = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _p : Object, typeof (_q = typeof admin_dto_1.AnnouncementDto !== "undefined" && admin_dto_1.AnnouncementDto) === "function" ? _q : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createAnn", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("admin/announcements/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_r = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _r : Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteAnn", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("user:manage"),
    (0, common_1.Get)("admin/creators"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "creators", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("user:manage"),
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("admin/creators/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_s = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _s : Object, String, typeof (_t = typeof admin_dto_1.CreatorStatusDto !== "undefined" && admin_dto_1.CreatorStatusDto) === "function" ? _t : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "creatorStatus", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("review:moderate"),
    (0, common_1.Get)("admin/reviews"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_u = typeof admin_dto_1.AdminListQuery !== "undefined" && admin_dto_1.AdminListQuery) === "function" ? _u : Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "reviews", null);
__decorate([
    (0, common_1.Get)("announcements"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "publicAnnouncements", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [typeof (_a = typeof admin_service_1.AdminService !== "undefined" && admin_service_1.AdminService) === "function" ? _a : Object])
], AdminController);
