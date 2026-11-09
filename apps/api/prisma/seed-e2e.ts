import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

// Test data for the automated browser tests. Refuses to touch a database that isn't clearly a test database.
const db = new PrismaClient();
export const E2E = { adminEmail: "admin-e2e@example.com", adminPassword: "e2e-admin-password-1", comicSlug: "e2e-test-comic" };

async function main() {
  if (!/test/i.test(process.env.DATABASE_URL ?? "")) throw new Error("DATABASE_URL must contain 'test'. Refusing to seed.");
  for (const key of ["comic:write", "chapter:write", "user:manage", "review:moderate", "audit:read"]) await db.permission.upsert({ where: { key }, update: {}, create: { key } });
  const perms = await db.permission.findMany();
  const admin = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN", permissions: { connect: perms.map((p) => ({ id: p.id })) } } });
  await db.role.upsert({ where: { name: "USER" }, update: {}, create: { name: "USER" } });
  await db.role.upsert({ where: { name: "CREATOR" }, update: {}, create: { name: "CREATOR" } });
  await db.genre.upsert({ where: { slug: "action" }, update: {}, create: { name: "Action", slug: "action" } });
  await db.user.upsert({ where: { email: E2E.adminEmail }, update: {}, create: { username: "e2eadmin", email: E2E.adminEmail, emailVerifiedAt: new Date(), roleId: admin.id, passwordHash: await argon2.hash(E2E.adminPassword, { type: argon2.argon2id }) } });

  if (!(await db.comic.findUnique({ where: { slug: E2E.comicSlug } }))) {
    const comic = await db.comic.create({ data: { slug: E2E.comicSlug, title: "E2E Test Comic", description: "Fixture comic for automated tests.", author: "Test", artist: "Test", type: "MANHWA", releaseYear: 2026, publishState: "PUBLISHED", genres: { create: [{ genre: { connect: { slug: "action" } } }] } } });
    for (const n of [1, 2]) {
      const ch = await db.chapter.create({ data: { id: `e2e-chapter-000${n}`, comicId: comic.id, number: n, title: `Chapter ${n}`, publishState: "PUBLISHED", publishedAt: new Date() } });
      for (let p = 1; p <= 3; p++) await db.chapterImage.create({ data: { chapterId: ch.id, position: p - 1, storageKey: `e2e/ch${n}-p${p}.png`, width: 800, height: 1200, sha256: `e2e-${n}-${p}` } });
    }
  }
  console.log("E2E data ready");
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
