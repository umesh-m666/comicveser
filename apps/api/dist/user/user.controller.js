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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const auth_guard_1 = require("../auth/auth.guard");
const user_service_1 = require("./user.service");
const user_dto_1 = require("./dto/user.dto");
let UserController = class UserController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    profile(u) { return this.svc.profile(u.id); }
    update(u, d) { return this.svc.updateProfile(u.id, d); }
    password(u, d) { return this.svc.changePassword(u.id, u.sessionId, d); }
    bookmarks(u, q) { return this.svc.bookmarks(u.id, q); }
    isBookmarked(u, id) { return this.svc.isBookmarked(u.id, id); }
    add(u, d) { return this.svc.addBookmark(u.id, d.comicId); }
    remove(u, id) { return this.svc.removeBookmark(u.id, id); }
    setStatus(u, id, d) { return this.svc.setBookmarkStatus(u.id, id, d.status); }
    progress(u, d) { return this.svc.saveProgress(u.id, d); }
    reviews(u) { return this.svc.reviews(u.id); }
    deleteAccount(u, d) { return this.svc.deleteAccount(u.id, d.password); }
    /** Marks a chapter as finished (persists the purple "read" state). The reader calls this once the chapter is completed. */
    markRead(u, id) { return this.svc.markChapterRead(u.id, id); }
    readChapterIds(u, id) { return this.svc.readChapterIds(u.id, id); }
    readChapters(u) { return this.svc.readChapters(u.id); }
    stats(u) { return this.svc.stats(u.id); }
    history(u) { return this.svc.history(u.id); }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)("profile"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "profile", null);
__decorate([
    (0, common_1.Put)("profile"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _c : Object, typeof (_d = typeof user_dto_1.UpdateProfileDto !== "undefined" && user_dto_1.UpdateProfileDto) === "function" ? _d : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "update", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("password"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _e : Object, typeof (_f = typeof user_dto_1.ChangePasswordDto !== "undefined" && user_dto_1.ChangePasswordDto) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "password", null);
__decorate([
    (0, common_1.Get)("bookmarks"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_g = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _g : Object, typeof (_h = typeof user_dto_1.BookmarkQuery !== "undefined" && user_dto_1.BookmarkQuery) === "function" ? _h : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "bookmarks", null);
__decorate([
    (0, common_1.Get)("bookmarks/:comicId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_j = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _j : Object, String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "isBookmarked", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("bookmarks"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _k : Object, typeof (_l = typeof user_dto_1.BookmarkDto !== "undefined" && user_dto_1.BookmarkDto) === "function" ? _l : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "add", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("bookmarks/:comicId"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_m = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _m : Object, String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "remove", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("bookmarks/:comicId/status"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_o = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _o : Object, String, typeof (_p = typeof user_dto_1.BookmarkStatusDto !== "undefined" && user_dto_1.BookmarkStatusDto) === "function" ? _p : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "setStatus", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("progress"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_q = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _q : Object, typeof (_r = typeof user_dto_1.ProgressDto !== "undefined" && user_dto_1.ProgressDto) === "function" ? _r : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "progress", null);
__decorate([
    (0, common_1.Get)("reviews"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_s = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _s : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "reviews", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("account"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_t = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _t : Object, typeof (_u = typeof user_dto_1.DeleteAccountDto !== "undefined" && user_dto_1.DeleteAccountDto) === "function" ? _u : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "deleteAccount", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("chapters/:chapterId/read"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("chapterId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_v = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _v : Object, String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "markRead", null);
__decorate([
    (0, common_1.Get)("comics/:comicId/read-chapters"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_w = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _w : Object, String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "readChapterIds", null);
__decorate([
    (0, common_1.Get)("read-chapters"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_x = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _x : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "readChapters", null);
__decorate([
    (0, common_1.Get)("stats"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_y = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _y : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)("history"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_z = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _z : Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "history", null);
exports.UserController = UserController = __decorate([
    (0, swagger_1.ApiTags)("user"),
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Controller)("user"),
    __metadata("design:paramtypes", [typeof (_a = typeof user_service_1.UserService !== "undefined" && user_service_1.UserService) === "function" ? _a : Object])
], UserController);
