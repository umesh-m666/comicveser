"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const argon2 = __importStar(require("argon2"));
const prisma_service_1 = require("../prisma/prisma.service");
const mail_service_1 = require("../mail/mail.service");
const crypto_1 = require("../common/crypto");
const SESSION_DAYS = 30;
const hashPw = (p) => argon2.hash(p, { type: argon2.argon2id });
// Precomputed so unknown emails cost the same time as wrong passwords.
const DUMMY = hashPw("dummy-password-for-timing");
let AuthService = class AuthService {
    db;
    mail;
    constructor(db, mail) {
        this.db = db;
        this.mail = mail;
    }
    log = new common_1.Logger("Auth");
    async safeSend(to, subject, text) {
        try {
            await this.mail.send(to, subject, text);
        }
        catch (e) {
            this.log.error(`Email to user failed: ${e.message}`);
        }
    }
    web = () => process.env.WEB_ORIGIN ?? "http://localhost:3000";
    async issueToken(userId, type, hours) {
        const token = (0, crypto_1.randomToken)();
        await this.db.authToken.create({ data: { userId, type, tokenHash: (0, crypto_1.sha256)(token), expiresAt: new Date(Date.now() + hours * 3600_000) } });
        return token;
    }
    async register(d) {
        if (d.password !== d.confirmPassword)
            throw new common_1.BadRequestException("Passwords do not match.");
        const role = await this.db.role.findUniqueOrThrow({ where: { name: "USER" } });
        const user = await this.db.user.create({
            data: { username: d.username, email: d.email.toLowerCase(), passwordHash: await hashPw(d.password), roleId: role.id, profile: { create: {} } },
        }); // unique violations become a 409 via the global filter
        const token = await this.issueToken(user.id, "EMAIL_VERIFY", 48);
        await this.safeSend(user.email, "Verify your ComicVerse email", `${this.web()}/verify-email?token=${token}`);
        return { id: user.id, username: user.username };
    }
    async login(d, userAgent) {
        const user = await this.db.user.findFirst({ where: { email: d.email.toLowerCase(), deletedAt: null } });
        const ok = await argon2.verify(user?.passwordHash ?? (await DUMMY), d.password).catch(() => false);
        if (!user || !ok)
            throw new common_1.UnauthorizedException("Email or password is incorrect.");
        if (user.status !== "ACTIVE")
            throw new common_1.UnauthorizedException("This account is suspended.");
        const token = (0, crypto_1.randomToken)();
        await this.db.session.create({ data: { tokenHash: (0, crypto_1.sha256)(token), userId: user.id, userAgent: userAgent?.slice(0, 200), expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5) } });
        return { token, maxAgeMs: SESSION_DAYS * 864e5 };
    }
    async logout(sessionId) { await this.db.session.deleteMany({ where: { id: sessionId } }); }
    async verifyEmail(token) {
        const t = await this.db.authToken.findUnique({ where: { tokenHash: (0, crypto_1.sha256)(token) } });
        if (!t || t.type !== "EMAIL_VERIFY" || t.usedAt || t.expiresAt < new Date())
            throw new common_1.BadRequestException("This link is invalid or has expired.");
        await this.db.$transaction([
            this.db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
            this.db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
        ]);
    }
    async forgot(email) {
        const user = await this.db.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });
        if (!user)
            return;
        const token = await this.issueToken(user.id, "PASSWORD_RESET", 1);
        await this.safeSend(user.email, "Reset your ComicVerse password", `${this.web()}/reset-password?token=${token}`);
    }
    async reset(token, password) {
        const t = await this.db.authToken.findUnique({ where: { tokenHash: (0, crypto_1.sha256)(token) } });
        if (!t || t.type !== "PASSWORD_RESET" || t.usedAt || t.expiresAt < new Date())
            throw new common_1.BadRequestException("This link is invalid or has expired.");
        const passwordHash = await hashPw(password);
        await this.db.$transaction([
            this.db.user.update({ where: { id: t.userId }, data: { passwordHash } }),
            this.db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
            this.db.session.deleteMany({ where: { userId: t.userId } }), // sign out everywhere
        ]);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map