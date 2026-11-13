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
var _a, _b, _c, _d, _e, _f, _g, _h;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComicsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const comics_service_1 = require("./comics.service");
const comic_dto_1 = require("./dto/comic.dto");
const class_validator_1 = require("class-validator");
class ComicCoverUploadDto {
    contentType;
    size;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ComicCoverUploadDto.prototype, "contentType", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10 * 1024 * 1024),
    __metadata("design:type", Number)
], ComicCoverUploadDto.prototype, "size", void 0);
let ComicsController = class ComicsController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    // Static routes are declared before :slug so they are not captured by it.
    list(q) { return this.svc.list(q); }
    trending() { return this.svc.trending(); }
    latest() { return this.svc.latest(); }
    popular(period) { return this.svc.popular(period === "weekly" || period === "monthly" ? period : "all"); }
    chapters(id, order) {
        return this.svc.chapters(id, order === "asc" ? "asc" : "desc");
    }
    one(slug) { return this.svc.bySlug(slug); }
    search(q) { return this.svc.list(q); }
    coverUpload(d) { return this.svc.coverUploadUrl(d.contentType, d.size); }
    create(u, dto) { return this.svc.create(dto, u.id); }
    update(u, id, dto) { return this.svc.update(id, dto, u.id); }
    async remove(u, id) { await this.svc.remove(id, u.id); }
};
exports.ComicsController = ComicsController;
__decorate([
    (0, common_1.Get)("comics"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof comic_dto_1.ListComicsQuery !== "undefined" && comic_dto_1.ListComicsQuery) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)("comics/trending"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "trending", null);
__decorate([
    (0, common_1.Get)("comics/latest"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "latest", null);
__decorate([
    (0, common_1.Get)("comics/popular"),
    __param(0, (0, common_1.Query)("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "popular", null);
__decorate([
    (0, common_1.Get)("comics/:id/chapters"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)("order")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "chapters", null);
__decorate([
    (0, common_1.Get)("comics/:slug"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "one", null);
__decorate([
    (0, common_1.Get)("search"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof comic_dto_1.ListComicsQuery !== "undefined" && comic_dto_1.ListComicsQuery) === "function" ? _c : Object]),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "search", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("admin/comic-uploads"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ComicCoverUploadDto]),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "coverUpload", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Post)("admin/comics"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_d = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _d : Object, typeof (_e = typeof comic_dto_1.CreateComicDto !== "undefined" && comic_dto_1.CreateComicDto) === "function" ? _e : Object]),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "create", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Put)("admin/comics/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _f : Object, String, typeof (_g = typeof comic_dto_1.UpdateComicDto !== "undefined" && comic_dto_1.UpdateComicDto) === "function" ? _g : Object]),
    __metadata("design:returntype", void 0)
], ComicsController.prototype, "update", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("admin/comics/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _h : Object, String]),
    __metadata("design:returntype", Promise)
], ComicsController.prototype, "remove", null);
exports.ComicsController = ComicsController = __decorate([
    (0, swagger_1.ApiTags)("comics"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [typeof (_a = typeof comics_service_1.ComicsService !== "undefined" && comics_service_1.ComicsService) === "function" ? _a : Object])
], ComicsController);
