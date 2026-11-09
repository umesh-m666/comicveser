import { PrismaService } from "../prisma/prisma.service";
import { sha256 } from "./crypto";

/** Returns the signed-in user's id if a valid session cookie is present; never throws. */
export async function optionalUserId(db: PrismaService, req: { cookies?: Record<string, string> }): Promise<string | null> {
  const t = req.cookies?.["cv_session"];
  if (!t) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(t) }, select: { userId: true, expiresAt: true } });
  return s && s.expiresAt > new Date() ? s.userId : null;
}
