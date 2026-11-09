import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, UseGuards, applyDecorators, createParamDecorator } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { sha256 } from "../common/crypto";

export const SESSION_COOKIE = "cv_session";
export interface AuthUser { id: string; username: string; email: string; role: string; permissions: string[]; emailVerified: boolean; sessionId: string }

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private db: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException("Please log in.");
    const s = await this.db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { include: { role: { include: { permissions: true } } } } } });
    if (!s || s.expiresAt < new Date()) throw new UnauthorizedException("Your session has expired. Please log in again.");
    if (s.user.status !== "ACTIVE" || s.user.deletedAt) throw new ForbiddenException("This account is not active.");
    req.user = { id: s.user.id, username: s.user.username, email: s.user.email, role: s.user.role.name,
      permissions: s.user.role.permissions.map((p: { key: string }) => p.key), emailVerified: !!s.user.emailVerifiedAt, sessionId: s.id } satisfies AuthUser;
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const need = this.reflector.get<string>("perm", ctx.getHandler());
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    if (need && !user.permissions.includes(need)) throw new ForbiddenException("You do not have permission to do that.");
    return true;
  }
}

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    if (user.role !== "ADMIN") throw new ForbiddenException("Administrator access is required.");
    return true;
  }
}

export const Authenticated = () => UseGuards(SessionGuard);
export const RequirePermission = (perm: string) => applyDecorators(SetMetadata("perm", perm), UseGuards(SessionGuard, PermissionGuard));
export const RequireAdmin = () => applyDecorators(SetMetadata("perm", "comic:write"), UseGuards(SessionGuard, AdminRoleGuard, PermissionGuard));
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

// CSRF defence: cookies are SameSite=Lax, and every state-changing request must come from the web origin.
export const SkipOrigin = () => SetMetadata("skipOrigin", true);

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    if (this.reflector.get<boolean>("skipOrigin", ctx.getHandler())) return true; // only for routes that verify their own signature
    const req = ctx.switchToHttp().getRequest();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
    const origin = req.headers.origin as string | undefined;
    const allowed = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    if (origin !== allowed) throw new ForbiddenException("Request origin not allowed.");
    return true;
  }
}
