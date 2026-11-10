import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
  applyDecorators,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { sha256 } from "../common/crypto";
import { isOriginAllowed } from "../common/config";

export const SESSION_COOKIE = "cv_session";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  emailVerified: boolean;
  avatarUrl?: string | null;
  authProvider?: string;
  sessionId: string;
}

export function extractCandidateTokens(req: {
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}): string[] {
  const tokens: string[] = [];
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && /^Bearer\s+/i.test(authHeader)) {
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (bearer) tokens.push(bearer);
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE]?.trim();
  if (cookieToken && !tokens.includes(cookieToken)) {
    tokens.push(cookieToken);
  }
  return tokens;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private db: PrismaService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const candidates = extractCandidateTokens(req);
    if (candidates.length === 0) {
      throw new UnauthorizedException("Please log in.");
    }

    const now = new Date();
    let matchedSession: any = null;
    for (const rawToken of candidates) {
      const s = await this.db.session.findUnique({
        where: { tokenHash: sha256(rawToken) },
        include: {
          user: {
            include: {
              role: { include: { permissions: true } },
              profile: true,
            },
          },
        },
      });
      if (s && s.expiresAt >= now) {
        matchedSession = s;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException("Your session has expired. Please log in again.");
    }
    if (matchedSession.user.status !== "ACTIVE" || matchedSession.user.deletedAt) {
      throw new ForbiddenException("This account is not active.");
    }

    req.user = {
      id: matchedSession.user.id,
      username: matchedSession.user.username,
      email: matchedSession.user.email,
      role: matchedSession.user.role.name,
      permissions: matchedSession.user.role.permissions.map((p: { key: string }) => p.key),
      emailVerified: !!matchedSession.user.emailVerifiedAt,
      avatarUrl: matchedSession.user.profile?.avatarUrl ?? null,
      authProvider: (matchedSession.user as any).authProvider ?? "local",
      sessionId: matchedSession.id,
    } satisfies AuthUser;

    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const need = this.reflector.get<string>("perm", ctx.getHandler());
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    if (need && !user.permissions.includes(need)) {
      throw new ForbiddenException("You do not have permission to do that.");
    }
    return true;
  }
}

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Administrator access is required.");
    }
    return true;
  }
}

export const Authenticated = () => UseGuards(SessionGuard);
export const RequirePermission = (perm: string) =>
  applyDecorators(SetMetadata("perm", perm), UseGuards(SessionGuard, PermissionGuard));
export const RequireAdmin = () =>
  applyDecorators(SetMetadata("perm", "comic:write"), UseGuards(SessionGuard, AdminRoleGuard, PermissionGuard));
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

export const SkipOrigin = () => SetMetadata("skipOrigin", true);

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    if (this.reflector.get<boolean>("skipOrigin", ctx.getHandler())) return true;
    const req = ctx.switchToHttp().getRequest();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
    const origin = req.headers?.origin as string | undefined;
    if (origin && !isOriginAllowed(origin)) {
      throw new ForbiddenException("Request origin not allowed.");
    }
    return true;
  }
}
