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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const auth_guard_1 = require("./auth.guard");
const auth_dto_1 = require("./dto/auth.dto");
const cookieOpts = () => ({ httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", domain: process.env.COOKIE_DOMAIN || undefined });
const strict = { default: { limit: 5, ttl: 60_000 } };
let AuthController = class AuthController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    register(d) { return this.svc.register(d); }
    async login(d, req, res) {
        const { token, maxAgeMs } = await this.svc.login(d, req.headers["user-agent"]);
        res.cookie(auth_guard_1.SESSION_COOKIE, token, { ...cookieOpts(), maxAge: maxAgeMs });
        return { ok: true };
    }
    async logout(u, res) {
        await this.svc.logout(u.sessionId);
        res.clearCookie(auth_guard_1.SESSION_COOKIE, cookieOpts());
    }
    me({ sessionId, ...u }) { return u; }
    verify(d) { return this.svc.verifyEmail(d.token); }
    async forgot(d) { await this.svc.forgot(d.email); return { ok: true }; }
    reset(d) { return this.svc.reset(d.token, d.password); }
};
exports.AuthController = AuthController;
__decorate([
    (0, throttler_1.Throttle)(strict),
    (0, common_1.Post)("register"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    (0, throttler_1.Throttle)(strict),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("login"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("logout"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("me"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, throttler_1.Throttle)(strict),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("verify-email"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.VerifyDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verify", null);
__decorate([
    (0, throttler_1.Throttle)(strict),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("forgot-password"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ForgotDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgot", null);
__decorate([
    (0, throttler_1.Throttle)(strict),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("reset-password"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ResetDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "reset", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Controller)("auth"),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map