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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChaptersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const chapters_service_1 = require("./chapters.service");
const chapter_dto_1 = require("./dto/chapter.dto");
let ChaptersController = class ChaptersController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    meta(id) { return this.svc.meta(id); }
    images(id, q) { return this.svc.images(id, q.from, q.limit); }
    create(u, d) { return this.svc.create(d, u.id); }
    update(u, id, d) { return this.svc.update(id, d, u.id); }
    uploadUrl(d) { return this.svc.uploadUrl(d); }
    register(u, id, d) { return this.svc.registerImages(id, d, u.id); }
    reorder(u, id, d) { return this.svc.reorder(id, d.ids, u.id); }
};
exports.ChaptersController = ChaptersController;
__decorate([
    (0, common_1.Get)("chapters/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChaptersController.prototype, "meta", null);
__decorate([
    (0, common_1.Get)("chapters/:id/images"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_b = typeof chapter_dto_1.ImagesQuery !== "undefined" && chapter_dto_1.ImagesQuery) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], ChaptersController.prototype, "images", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.Post)("admin/chapters"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _c : Object, typeof (_d = typeof chapter_dto_1.CreateChapterDto !== "undefined" && chapter_dto_1.CreateChapterDto) === "function" ? _d : Object]),
    __metadata("design:returntype", void 0)
], ChaptersController.prototype, "create", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.Put)("admin/chapters/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _e : Object, String, typeof (_f = typeof chapter_dto_1.UpdateChapterDto !== "undefined" && chapter_dto_1.UpdateChapterDto) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], ChaptersController.prototype, "update", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/uploads"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_g = typeof chapter_dto_1.UploadUrlDto !== "undefined" && chapter_dto_1.UploadUrlDto) === "function" ? _g : Object]),
    __metadata("design:returntype", void 0)
], ChaptersController.prototype, "uploadUrl", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.Post)("admin/chapters/:id/images"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _h : Object, String, typeof (_j = typeof chapter_dto_1.RegisterImagesDto !== "undefined" && chapter_dto_1.RegisterImagesDto) === "function" ? _j : Object]),
    __metadata("design:returntype", void 0)
], ChaptersController.prototype, "register", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("chapter:write"),
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("admin/chapters/:id/images/order"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _k : Object, String, typeof (_l = typeof chapter_dto_1.ReorderDto !== "undefined" && chapter_dto_1.ReorderDto) === "function" ? _l : Object]),
    __metadata("design:returntype", void 0)
], ChaptersController.prototype, "reorder", null);
exports.ChaptersController = ChaptersController = __decorate([
    (0, swagger_1.ApiTags)("chapters"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [typeof (_a = typeof chapters_service_1.ChaptersService !== "undefined" && chapters_service_1.ChaptersService) === "function" ? _a : Object])
], ChaptersController);
