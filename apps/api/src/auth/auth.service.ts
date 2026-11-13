import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { AuthTokenType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { randomToken, sha256 } from "../common/crypto";
import { primaryWebOrigin } from "../common/config";
import { GoogleAuthDto, LoginDto, RegisterDto } from "./dto/auth.dto";
import { GoogleTokenVerifier } from "./google-token.verifier";

const SESSION_DAYS = 30;
const hashPw = (p: string) => argon2.hash(p, { type: argon2.argon2id });
const DUMMY = hashPw("dummy-password-for-timing");

export interface AuthFailureRecord {
  at: string;
  method: "password" | "google" | "verify" | "reset";
  email?: string;
  reason: string;
  message: string;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger("Auth");
  private failures: AuthFailureRecord[] = [];

  constructor(
    private db: PrismaService,
    private mail: MailService,
    private googleVerifier: GoogleTokenVerifier,
  ) {}

  private recordFailure(
    method: AuthFailureRecord["method"],
    reason: string,
    message: string,
    email?: string,
  ) {
    this.failures.push({
      at: new Date().toISOString(),
      method,
      email,
      reason,
      message,
    });
    if (this.failures.length > 50) this.failures.shift();
  }

  getRecentAuthFailures(): AuthFailureRecord[] {
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

  private web = () => primaryWebOrigin();

  private formatUser(user: any) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role?.name ?? "USER",
      permissions: Array.isArray(user.role?.permissions)
        ? user.role.permissions.map((p: { key: string }) => p.key)
        : [],
      emailVerified: Boolean(user.emailVerifiedAt),
      avatarUrl: user.profile?.avatarUrl ?? null,
      authProvider: user.authProvider ?? "local",
    };
  }

  private async ensureUserRole() {
    const existing = await this.db.role.findUnique({ where: { name: "USER" } });
    if (existing) return existing;
    return this.db.role.create({ data: { name: "USER" } });
  }

  private async issueToken(userId: string, type: AuthTokenType, hours: number) {
    const token = randomToken();
    await this.db.authToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + hours * 3600_000),
      },
    });
    return token;
  }

  private async createSessionForUser(userId: string, userAgent?: string) {
    const token = randomToken();
    const maxAgeMs = SESSION_DAYS * 864e5;
    await this.db.session.create({
      data: {
        tokenHash: sha256(token),
        userId,
        userAgent: userAgent?.slice(0, 200),
        expiresAt: new Date(Date.now() + maxAgeMs),
      },
    });
    return { token, maxAgeMs };
  }

  async register(d: RegisterDto) {
    if (d.password !== d.confirmPassword) {
      throw new BadRequestException("Passwords do not match.");
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
    } catch (e) {
      this.log.error(`Verification email to ${user.email} failed: ${(e as Error).message}`);
    }
    return { id: user.id, username: user.username, email: user.email };
  }

  async login(d: LoginDto, userAgent?: string) {
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
      throw new UnauthorizedException("Email or password is incorrect.");
    }
    if (user.status !== "ACTIVE") {
      this.recordFailure("password", "ACCOUNT_SUSPENDED", "Suspended user attempted login", email);
      throw new UnauthorizedException("This account is suspended.");
    }
    const { token, maxAgeMs } = await this.createSessionForUser(user.id, userAgent);
    return {
      token,
      maxAgeMs,
      user: this.formatUser(user),
    };
  }

  private async generateUniqueUsername(preferredName?: string, email?: string): Promise<string> {
    const rawBase = (preferredName || email?.split("@")[0] || "reader")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 22);
    const base = rawBase.length >= 3 ? rawBase : `reader_${rawBase || "user"}`.slice(0, 22);

    const existing = await this.db.user.findUnique({ where: { username: base } });
    if (!existing) return base;

    for (let i = 2; i <= 50; i++) {
      const candidate = `${base.slice(0, 24)}_${i}`;
      const taken = await this.db.user.findUnique({ where: { username: candidate } });
      if (!taken) return candidate;
    }
    return `${base.slice(0, 20)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async setUserGoogleColumns(userId: string, googleId: string, authProvider: string) {
    try {
      await (this.db.user as any).update({
        where: { id: userId },
        data: { googleId, authProvider },
      });
      return;
    } catch {
      // Fallback to raw SQL if runtime Prisma client DMMF predates googleId column
    }
    try {
      await this.db.$executeRawUnsafe(
        `UPDATE "User" SET "googleId" = $1, "authProvider" = $2 WHERE "id" = $3`,
        googleId,
        authProvider,
        userId,
      );
    } catch {
      // Ignore in mock environment without raw SQL
    }
  }

  private async findUserByGoogleIdOrEmail(googleId: string, email: string) {
    // 1. Check by email first (always indexed and supported)
    let user = await this.db.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      include: {
        role: { include: { permissions: true } },
        profile: true,
      },
    });
    if (user) return user;

    // 2. Check by googleId in case user changed email later
    try {
      user = await (this.db.user as any).findFirst({
        where: { googleId, deletedAt: null },
        include: {
          role: { include: { permissions: true } },
          profile: true,
        },
      });
      if (user) return user;
    } catch {
      try {
        const rows = await this.db.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "User" WHERE "googleId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
          googleId,
        );
        if (rows?.[0]?.id) {
          return this.db.user.findUnique({
            where: { id: rows[0].id },
            include: {
              role: { include: { permissions: true } },
              profile: true,
            },
          });
        }
      } catch {
        // Ignore if raw query unsupported in mock
      }
    }
    return null;
  }

  async googleLogin(d: GoogleAuthDto, userAgent?: string) {
    const rawToken = (d.credential ?? d.idToken ?? "").trim();
    if (!rawToken) {
      throw new BadRequestException("Google ID token is required.");
    }

    let profile;
    try {
      profile = await this.googleVerifier.verifyIdToken(rawToken);
    } catch (err) {
      this.recordFailure("google", "INVALID_GOOGLE_TOKEN", (err as Error).message);
      throw err;
    }

    const email = profile.email.toLowerCase();
    let user = await this.findUserByGoogleIdOrEmail(profile.sub, email);
    let isNewUser = false;

    if (user) {
      if (user.status !== "ACTIVE") {
        this.recordFailure("google", "ACCOUNT_SUSPENDED", "Suspended user attempted Google login", email);
        throw new UnauthorizedException("This account is suspended.");
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

      const currentProvider = (user as any).authProvider ?? "local";
      const nextProvider = currentProvider.includes("google") ? currentProvider : `${currentProvider},google`;
      await this.setUserGoogleColumns(user.id, profile.sub, nextProvider);
      (user as any).googleId = profile.sub;
      (user as any).authProvider = nextProvider;

      if (profile.picture && !user.profile?.avatarUrl) {
        try {
          await this.db.userProfile.upsert({
            where: { userId: user.id },
            update: { avatarUrl: profile.picture },
            create: { userId: user.id, avatarUrl: profile.picture },
          });
          if (user.profile) user.profile.avatarUrl = profile.picture;
        } catch {
          // Non-fatal profile avatar update
        }
      }
    } else {
      isNewUser = true;
      const role = await this.ensureUserRole();
      const username = await this.generateUniqueUsername(profile.name || profile.givenName, email);
      const randomPasswordHash = await hashPw(randomToken());

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
      (user as any).googleId = profile.sub;
      (user as any).authProvider = "google";

      try {
        await this.mail.sendAccountNoticeEmail(
          user.email,
          user.username,
          "Welcome to ComicVerse!",
          "Your ComicVerse account has been created with Google Sign-In. You can start reading, bookmarking series, and syncing your reading progress across devices.",
          this.web(),
        );
      } catch (e) {
        this.log.warn(`Welcome email failed for ${user.email}: ${(e as Error).message}`);
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
    } catch {
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

  async logout(sessionId: string) {
    await this.db.session.deleteMany({ where: { id: sessionId } });
  }

  async verifyEmail(token: string) {
    const t = await this.db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!t || t.type !== "EMAIL_VERIFY" || t.usedAt || t.expiresAt < new Date()) {
      this.recordFailure("verify", "INVALID_VERIFY_TOKEN", "Invalid or expired email verification token");
      throw new BadRequestException("This link is invalid or has expired.");
    }
    await this.db.$transaction([
      this.db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
      this.db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    ]);
  }

  async forgot(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.db.user.findFirst({ where: { email: normalized, deletedAt: null } });
    if (!user) return;
    const token = await this.issueToken(user.id, "PASSWORD_RESET", 1);
    const resetUrl = `${this.web()}/reset-password?token=${token}`;
    try {
      await this.mail.sendPasswordResetEmail(user.email, user.username, resetUrl);
    } catch (e) {
      this.log.error(`Password reset email to ${user.email} failed: ${(e as Error).message}`);
    }
  }

  async reset(token: string, password: string) {
    const t = await this.db.authToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!t || t.type !== "PASSWORD_RESET" || t.usedAt || t.expiresAt < new Date()) {
      this.recordFailure("reset", "INVALID_RESET_TOKEN", "Invalid or expired password reset token");
      throw new BadRequestException("This link is invalid or has expired.");
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
      } catch (e) {
        this.log.warn(`Password changed confirmation email failed: ${(e as Error).message}`);
      }
    }
  }
}
