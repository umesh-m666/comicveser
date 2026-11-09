import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { AuthTokenType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { randomToken, sha256 } from "../common/crypto";
import { LoginDto, RegisterDto } from "./dto/auth.dto";

const SESSION_DAYS = 30;
const hashPw = (p: string) => argon2.hash(p, { type: argon2.argon2id });
// Precomputed so unknown emails cost the same time as wrong passwords.
const DUMMY = hashPw("dummy-password-for-timing");

@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private mail: MailService) {}
  private log = new Logger("Auth");
  private async safeSend(to: string, subject: string, text: string) {
    try { await this.mail.send(to, subject, text); } catch (e) { this.log.error(`Email to user failed: ${(e as Error).message}`); }
  }
  private web = () => process.env.WEB_ORIGIN ?? "http://localhost:3000";

  private async issueToken(userId: string, type: AuthTokenType, hours: number) {
    const token = randomToken();
    await this.db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + hours * 3600_000) } });
    return token;
  }

  async register(d: RegisterDto) {
    if (d.password !== d.confirmPassword) throw new BadRequestException("Passwords do not match.");
    const role = await this.db.role.findUniqueOrThrow({ where: { name: "USER" } });
    const user = await this.db.user.create({
      data: { username: d.username, email: d.email.toLowerCase(), passwordHash: await hashPw(d.password), roleId: role.id, profile: { create: {} } },
    }); // unique violations become a 409 via the global filter
    const token = await this.issueToken(user.id, "EMAIL_VERIFY", 48);
    await this.safeSend(user.email, "Verify your ComicVerse email", `${this.web()}/verify-email?token=${token}`);
    return { id: user.id, username: user.username };
  }

  async login(d: LoginDto, userAgent?: string) {
    const user = await this.db.user.findFirst({ where: { email: d.email.toLowerCase(), deletedAt: null } });
    const ok = await argon2.verify(user?.passwordHash ?? (await DUMMY), d.password).catch(() => false);
    if (!user || !ok) throw new UnauthorizedException("Email or password is incorrect.");
    if (user.status !== "ACTIVE") throw new UnauthorizedException("This account is suspended.");
    const token = randomToken();
    await this.db.session.create({ data: { tokenHash: sha256(token), userId: user.id, userAgent: userAgent?.slice(0, 200), expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5) } });
    return { token, maxAgeMs: SESSION_DAYS * 864e5 };
  }

  async logout(sessionId: string) { await this.db.session.deleteMany({ where: { id: sessionId } }); }

  async verifyEmail(token: string) {
    const t = await this.db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!t || t.type !== "EMAIL_VERIFY" || t.usedAt || t.expiresAt < new Date()) throw new BadRequestException("This link is invalid or has expired.");
    await this.db.$transaction([
      this.db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
      this.db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    ]);
  }

  async forgot(email: string) { // always succeeds so accounts cannot be enumerated
    const user = await this.db.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });
    if (!user) return;
    const token = await this.issueToken(user.id, "PASSWORD_RESET", 1);
    await this.safeSend(user.email, "Reset your ComicVerse password", `${this.web()}/reset-password?token=${token}`);
  }

  async reset(token: string, password: string) {
    const t = await this.db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!t || t.type !== "PASSWORD_RESET" || t.usedAt || t.expiresAt < new Date()) throw new BadRequestException("This link is invalid or has expired.");
    const passwordHash = await hashPw(password);
    await this.db.$transaction([
      this.db.user.update({ where: { id: t.userId }, data: { passwordHash } }),
      this.db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
      this.db.session.deleteMany({ where: { userId: t.userId } }), // sign out everywhere
    ]);
  }
}
