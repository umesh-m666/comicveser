import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "crypto";

// TEMPORARY server-side guard for admin writes. Replaced by session auth + RBAC in Phase 3.
@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const expected = process.env.ADMIN_API_KEY ?? "";
    const given = String(ctx.switchToHttp().getRequest().headers["x-admin-key"] ?? "");
    const a = Buffer.from(given), b = Buffer.from(expected);
    if (!expected || expected.length < 16 || a.length !== b.length || !timingSafeEqual(a, b))
      throw new UnauthorizedException("Admin access required.");
    return true;
  }
}
