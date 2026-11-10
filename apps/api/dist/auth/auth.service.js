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
const config_1 = require("../common/config");
const google_token_verifier_1 = require("./google-token.verifier");
const SESSION_DAYS = 30;
const hashPw = (p) => argon2.hash(p, { type: argon2.argon2id });
const DUMMY = hashPw("dummy-password-for-timing");
let AuthService = class AuthService {
    db;
    mail;
    googleVerifier;
    log = new common_1.Logger("Auth");
    failures = [];
    constructor(db, mail, googleVerifier) {
        this.db = db;
        this.mail = mail;
        this.googleVerifier = googleVerifier;
    }
    recordFailure(method, reason, message, email) {
        this.failures.push({
            at: new Date().toISOString(),
            method,
            email,
            reason,
            message,
        });
        if (this.failures.length > 50)
            this.failures.shift();
    }
    getRecentAuthFailures() {
        return [...this.failures].reverse();
    }
    getAuthConfig() {
        const clientIds = this.googleVerifier.getConfiguredClientIds();
        const primaryClientId = clientIds[0] ?? null;
        return {
            googleEnabled: Boolean(primaryClientId),
            googleClientId: primaryClientId,
        };
    }
    web = () => (0, config_1.primaryWebOrigin)();
    formatUser(user) {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role?.name ?? "USER",
            permissions: Array.isArray(user.role?.permissions)
                ? user.role.permissions.map((p) => p.key)
                : [],
            emailVerified: Boolean(user.emailVerifiedAt),
            avatarUrl: user.profile?.avatarUrl ?? null,
            authProvider: user.authProvider ?? "local",
        };
    }
    async ensureUserRole() {
        const existing = await this.db.role.findUnique({ where: { name: "USER" } });
        if (existing)
            return existing;
        return this.db.role.create({ data: { name: "USER" } });
    }
    async issueToken(userId, type, hours) {
        const token = (0, crypto_1.randomToken)();
        await this.db.authToken.create({
            data: {
                userId,
                type,
                tokenHash: (0, crypto_1.sha256)(token),
                expiresAt: new Date(Date.now() + hours * 3600_000),
            },
        });
        return token;
    }
    async createSessionForUser(userId, userAgent) {
        const token = (0, crypto_1.randomToken)();
        const maxAgeMs = SESSION_DAYS * 864e5;
        await this.db.session.create({
            data: {
                tokenHash: (0, crypto_1.sha256)(token),
                userId,
                userAgent: userAgent?.slice(0, 200),
                expiresAt: new Date(Date.now() + maxAgeMs),
            },
        });
        return { token, maxAgeMs };
    }
    async register(d) {
        if (d.password !== d.confirmPassword) {
            throw new common_1.BadRequestException("Passwords do not match.");
        }
        const role = await this.ensureUserRole();
        const email = d.email.trim().toLowerCase();
        const username = d.username.trim();
        const user = await this.db.user.create({
            data: {
                username,
                email,
                passwordHash: await hashPw(d.password),
                roleId: role.id,
                profile: { create: {} },
            },
        });
        const token = await this.issueToken(user.id, "EMAIL_VERIFY", 48);
        const verifyUrl = `${this.web()}/verify-email?token=${token}`;
        try {
            await this.mail.sendVerificationEmail(user.email, user.username, verifyUrl);
        }
        catch (e) {
            this.log.error(`Verification email to ${user.email} failed: ${e.message}`);
        }
        return { id: user.id, username: user.username, email: user.email };
    }
    async login(d, userAgent) {
        const email = d.email.trim().toLowerCase();
        const user = await this.db.user.findFirst({
            where: { email, deletedAt: null },
            include: {
                role: { include: { permissions: true } },
                profile: true,
            },
        });
        const ok = await argon2.verify(user?.passwordHash ?? (await DUMMY), d.password).catch(() => false);
        if (!user || !ok) {
            this.recordFailure("password", "INVALID_CREDENTIALS", "Invalid email or password", email);
            throw new common_1.UnauthorizedException("Email or password is incorrect.");
        }
        if (user.status !== "ACTIVE") {
            this.recordFailure("password", "ACCOUNT_SUSPENDED", "Suspended user attempted login", email);
            throw new common_1.UnauthorizedException("This account is suspended.");
        }
        const { token, maxAgeMs } = await this.createSessionForUser(user.id, userAgent);
        return {
            token,
            maxAgeMs,
            user: this.formatUser(user),
        };
    }
    async generateUniqueUsername(preferredName, email) {
        const rawBase = (preferredName || email?.split("@")[0] || "reader")
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 22);
        const base = rawBase.length >= 3 ? rawBase : `reader_${rawBase || "user"}`.slice(0, 22);
        const existing = await this.db.user.findUnique({ where: { username: base } });
        if (!existing)
            return base;
        for (let i = 2; i <= 50; i++) {
            const candidate = `${base.slice(0, 24)}_${i}`;
            const taken = await this.db.user.findUnique({ where: { username: candidate } });
            if (!taken)
                return candidate;
        }
        return `${base.slice(0, 20)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    async setUserGoogleColumns(userId, googleId, authProvider) {
        try {
            await this.db.user.update({
                where: { id: userId },
                data: { googleId, authProvider },
            });
            return;
        }
        catch {
            // Fallback to raw SQL if runtime Prisma client DMMF predates googleId column
        }
        try {
            await this.db.$executeRawUnsafe(`UPDATE "User" SET "googleId" = $1, "authProvider" = $2 WHERE "id" = $3`, googleId, authProvider, userId);
        }
        catch {
            // Ignore in mock environment without raw SQL
        }
    }
    async findUserByGoogleIdOrEmail(googleId, email) {
        // 1. Check by email first (always indexed and supported)
        let user = await this.db.user.findFirst({
            where: { email: email.toLowerCase(), deletedAt: null },
            include: {
                role: { include: { permissions: true } },
                profile: true,
            },
        });
        if (user)
            return user;
        // 2. Check by googleId in case user changed email later
        try {
            user = await this.db.user.findFirst({
                where: { googleId, deletedAt: null },
                include: {
                    role: { include: { permissions: true } },
                    profile: true,
                },
            });
            if (user)
                return user;
        }
        catch {
            try {
                const rows = await this.db.$queryRawUnsafe(`SELECT "id" FROM "User" WHERE "googleId" = $1 AND "deletedAt" IS NULL LIMIT 1`, googleId);
                if (rows?.[0]?.id) {
                    return this.db.user.findUnique({
                        where: { id: rows[0].id },
                        include: {
                            role: { include: { permissions: true } },
                            profile: true,
                        },
                    });
                }
            }
            catch {
                // Ignore if raw query unsupported in mock
            }
        }
        return null;
    }
    async googleLogin(d, userAgent) {
        const rawToken = (d.credential ?? d.idToken ?? "").trim();
        if (!rawToken) {
            throw new common_1.BadRequestException("Google ID token is required.");
        }
        let profile;
        try {
            profile = await this.googleVerifier.verifyIdToken(rawToken);
        }
        catch (err) {
            this.recordFailure("google", "INVALID_GOOGLE_TOKEN", err.message);
            throw err;
        }
        const email = profile.email.toLowerCase();
        let user = await this.findUserByGoogleIdOrEmail(profile.sub, email);
        let isNewUser = false;
        if (user) {
            if (user.status !== "ACTIVE") {
                this.recordFailure("google", "ACCOUNT_SUSPENDED", "Suspended user attempted Google login", email);
                throw new common_1.UnauthorizedException("This account is suspended.");
            }
            // Link Google account and mark email verified while preserving existing Role (ADMIN, CREATOR, USER)
            const needsVerifyUpdate = !user.emailVerifiedAt;
            if (needsVerifyUpdate) {
                user = await this.db.user.update({
                    where: { id: user.id },
                    data: { emailVerifiedAt: new Date() },
                    include: {
                        role: { include: { permissions: true } },
                        profile: true,
                    },
                });
            }
            const currentProvider = user.authProvider ?? "local";
            const nextProvider = currentProvider.includes("google") ? currentProvider : `${currentProvider},google`;
            await this.setUserGoogleColumns(user.id, profile.sub, nextProvider);
            user.googleId = profile.sub;
            user.authProvider = nextProvider;
            if (profile.picture && !user.profile?.avatarUrl) {
                try {
                    await this.db.userProfile.upsert({
                        where: { userId: user.id },
                        update: { avatarUrl: profile.picture },
                        create: { userId: user.id, avatarUrl: profile.picture },
                    });
                    if (user.profile)
                        user.profile.avatarUrl = profile.picture;
                }
                catch {
                    // Non-fatal profile avatar update
                }
            }
        }
        else {
            isNewUser = true;
            const role = await this.ensureUserRole();
            const username = await this.generateUniqueUsername(profile.name || profile.givenName, email);
            const randomPasswordHash = await hashPw((0, crypto_1.randomToken)());
            user = await this.db.user.create({
                data: {
                    username,
                    email,
                    passwordHash: randomPasswordHash,
                    emailVerifiedAt: new Date(),
                    roleId: role.id,
                    profile: {
                        create: {
                            avatarUrl: profile.picture ?? null,
                        },
                    },
                },
                include: {
                    role: { include: { permissions: true } },
                    profile: true,
                },
            });
            await this.setUserGoogleColumns(user.id, profile.sub, "google");
            user.googleId = profile.sub;
            user.authProvider = "google";
            try {
                await this.mail.sendAccountNoticeEmail(user.email, user.username, "Welcome to ComicVerse!", "Your ComicVerse account has been created with Google Sign-In. You can start reading, bookmarking series, and syncing your reading progress across devices.", this.web());
            }
            catch (e) {
                this.log.warn(`Welcome email failed for ${user.email}: ${e.message}`);
            }
        }
        try {
            await this.db.auditLog.create({
                data: {
                    actorId: user.id,
                    action: isNewUser ? "auth.google.register" : "auth.google.login",
                    resource: "User",
                    resourceId: user.id,
                    meta: {
                        email: user.email,
                        role: user.role?.name ?? "USER",
                        isNewUser,
                    },
                },
            });
        }
        catch {
            // Non-fatal audit log
        }
        const { token, maxAgeMs } = await this.createSessionForUser(user.id, userAgent);
        return {
            token,
            maxAgeMs,
            isNewUser,
            user: this.formatUser(user),
        };
    }
    async logout(sessionId) {
        await this.db.session.deleteMany({ where: { id: sessionId } });
    }
    async verifyEmail(token) {
        const t = await this.db.authToken.findUnique({ where: { tokenHash: (0, crypto_1.sha256)(token) } });
        if (!t || t.type !== "EMAIL_VERIFY" || t.usedAt || t.expiresAt < new Date()) {
            this.recordFailure("verify", "INVALID_VERIFY_TOKEN", "Invalid or expired email verification token");
            throw new common_1.BadRequestException("This link is invalid or has expired.");
        }
        await this.db.$transaction([
            this.db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
            this.db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
        ]);
    }
    async forgot(email) {
        const normalized = email.trim().toLowerCase();
        const user = await this.db.user.findFirst({ where: { email: normalized, deletedAt: null } });
        if (!user)
            return;
        const token = await this.issueToken(user.id, "PASSWORD_RESET", 1);
        const resetUrl = `${this.web()}/reset-password?token=${token}`;
        try {
            await this.mail.sendPasswordResetEmail(user.email, user.username, resetUrl);
        }
        catch (e) {
            this.log.error(`Password reset email to ${user.email} failed: ${e.message}`);
        }
    }
    async reset(token, password) {
        const t = await this.db.authToken.findUnique({
            where: { tokenHash: (0, crypto_1.sha256)(token) },
            include: { user: true },
        });
        if (!t || t.type !== "PASSWORD_RESET" || t.usedAt || t.expiresAt < new Date()) {
            this.recordFailure("reset", "INVALID_RESET_TOKEN", "Invalid or expired password reset token");
            throw new common_1.BadRequestException("This link is invalid or has expired.");
        }
        const passwordHash = await hashPw(password);
        await this.db.$transaction([
            this.db.user.update({ where: { id: t.userId }, data: { passwordHash } }),
            this.db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
            this.db.session.deleteMany({ where: { userId: t.userId } }),
        ]);
        if (t.user?.email) {
            try {
                await this.mail.sendPasswordChangedEmail(t.user.email, t.user.username);
            }
            catch (e) {
                this.log.warn(`Password changed confirmation email failed: ${e.message}`);
            }
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mail_service_1.MailService,
        google_token_verifier_1.GoogleTokenVerifier])
], AuthService);
//# sourceMappingURL=auth.service.js.map