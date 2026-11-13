"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
// TEMPORARY server-side guard for admin writes. Replaced by session auth + RBAC in Phase 3.
let AdminKeyGuard = class AdminKeyGuard {
    canActivate(ctx) {
        const expected = process.env.ADMIN_API_KEY ?? "";
        const given = String(ctx.switchToHttp().getRequest().headers["x-admin-key"] ?? "");
        const a = Buffer.from(given), b = Buffer.from(expected);
        if (!expected || expected.length < 16 || a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b))
            throw new common_1.UnauthorizedException("Admin access required.");
        return true;
    }
};
exports.AdminKeyGuard = AdminKeyGuard;
exports.AdminKeyGuard = AdminKeyGuard = __decorate([
    (0, common_1.Injectable)()
], AdminKeyGuard);
