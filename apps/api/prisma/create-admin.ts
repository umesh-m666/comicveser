import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

// Creates the admin account, or repairs it if it already exists (resets password, role and status).
// Run from apps/api:  npx tsx --env-file=.env prisma/create-admin.ts
const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env first.");
  if (password.length < 8) throw new Error("Use a password of at least 8 characters (10+ recommended).");

  for (const key of ["comic:write", "chapter:write", "user:manage", "review:moderate", "audit:read"])
    await db.permission.upsert({ where: { key }, update: {}, create: { key } });
  const perms = await db.permission.findMany();
  const role = await db.role.upsert({
    where: { name: "ADMIN" }, update: { permissions: { set: perms.map((p) => ({ id: p.id })) } },
    create: { name: "ADMIN", permissions: { connect: perms.map((p) => ({ id: p.id })) } },
  });
  await db.role.upsert({ where: { name: "USER" }, update: {}, create: { name: "USER" } });

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const existing = await db.user.findFirst({ where: { OR: [{ email }, { username: "admin" }] } });
  const data = { email, passwordHash, roleId: role.id, status: "ACTIVE" as const, emailVerifiedAt: new Date(), deletedAt: null };
  if (existing) await db.user.update({ where: { id: existing.id }, data });
  else await db.user.create({ data: { username: "admin", ...data, profile: { create: {} } } });

  console.log(`Admin ready: log in with ${email}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());