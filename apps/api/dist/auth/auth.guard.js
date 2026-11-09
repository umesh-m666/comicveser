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
exports.OriginGuard = exports.SkipOrigin = exports.CurrentUser = exports.RequireAdmin = exports.RequirePermission = exports.Authenticated = exports.AdminRoleGuard = exports.PermissionGuard = exports.SessionGuard = exports.SESSION_COOKIE = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_1 = require("../common/crypto");
exports.SESSION_COOKIE = "cv_session";
let SessionGuard = class SessionGuard {
    db;
    constructor(db) {
        this.db = db;
    }
    async canActivate(ctx) {
        const req = ctx.switchToHttp().getRequest();
        const token = req.cookies?.[exports.SESSION_COOKIE];
        if (!token)
            throw new common_1.UnauthorizedException("Please log in.");
        const s = await this.db.session.findUnique({ where: { tokenHash: (0, crypto_1.sha256)(token) }, include: { user: { include: { role: { include: { permissions: true } } } } } });
        if (!s || s.expiresAt < new Date())
            throw new common_1.UnauthorizedException("Your session has expired. Please log in again.");
        if (s.user.status !== "ACTIVE" || s.user.deletedAt)
            throw new common_1.ForbiddenException("This account is not active.");
        req.user = { id: s.user.id, username: s.user.username, email: s.user.email, role: s.user.role.name,
            permissions: s.user.role.permissions.map((p) => p.key), emailVerified: !!s.user.emailVerifiedAt, sessionId: s.id };
        return true;
    }
};
exports.SessionGuard = SessionGuard;
exports.SessionGuard = SessionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SessionGuard);
let PermissionGuard = class PermissionGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(ctx) {
        const need = this.reflector.get("perm", ctx.getHandler());
        const user = ctx.switchToHttp().getRequest().user;
        if (need && !user.permissions.includes(need))
            throw new common_1.ForbiddenException("You do not have permission to do that.");
        return true;
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], PermissionGuard);
let AdminRoleGuard = class AdminRoleGuard {
    canActivate(ctx) {
        const user = ctx.switchToHttp().getRequest().user;
        if (user.role !== "ADMIN")
            throw new common_1.ForbiddenException("Administrator access is required.");
        return true;
    }
};
exports.AdminRoleGuard = AdminRoleGuard;
exports.AdminRoleGuard = AdminRoleGuard = __decorate([
    (0, common_1.Injectable)()
], AdminRoleGuard);
const Authenticated = () => (0, common_1.UseGuards)(SessionGuard);
exports.Authenticated = Authenticated;
const RequirePermission = (perm) => (0, common_1.applyDecorators)((0, common_1.SetMetadata)("perm", perm), (0, common_1.UseGuards)(SessionGuard, PermissionGuard));
exports.RequirePermission = RequirePermission;
const RequireAdmin = () => (0, common_1.applyDecorators)((0, common_1.SetMetadata)("perm", "comic:write"), (0, common_1.UseGuards)(SessionGuard, AdminRoleGuard, PermissionGuard));
exports.RequireAdmin = RequireAdmin;
exports.CurrentUser = (0, common_1.createParamDecorator)((_, ctx) => ctx.switchToHttp().getRequest().user);
// CSRF defence: cookies are SameSite=Lax, and every state-changing request must come from the web origin.
const SkipOrigin = () => (0, common_1.SetMetadata)("skipOrigin", true);
exports.SkipOrigin = SkipOrigin;
let OriginGuard = class OriginGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(ctx) {
        if (this.reflector.get("skipOrigin", ctx.getHandler()))
            return true; // only for routes that verify their own signature
        const req = ctx.switchToHttp().getRequest();
        if (["GET", "HEAD", "OPTIONS"].includes(req.method))
            return true;
        const origin = req.headers.origin;
        const allowed = process.env.WEB_ORIGIN ?? "http://localhost:3000";
        if (origin !== allowed)
            throw new common_1.ForbiddenException("Request origin not allowed.");
        return true;
    }
};
exports.OriginGuard = OriginGuard;
exports.OriginGuard = OriginGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], OriginGuard);
//# sourceMappingURL=auth.guard.js.map