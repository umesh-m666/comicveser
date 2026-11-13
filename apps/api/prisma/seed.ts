import * as argon2 from "argon2";
import { PrismaClient, ComicType, ComicStatus } from "@prisma/client";
const db = new PrismaClient();

const GENRES = ["Action","Adventure","Fantasy","Romance","Comedy","Drama","Martial Arts","Mystery","Horror","Supernatural","Sci-Fi","Historical","Reincarnation","Regression","School Life"];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Fictional development data only.
const COMICS = [
  { title: "Lanternkeeper of Ash", altTitle: "The Last Ember Warden", description: "In a city that burns every winter, a young lamplighter discovers the flames remember everyone they have taken.", author: "Mira Okonkwo", artist: "Taro Vance", genres: ["Fantasy","Drama","Supernatural"], type: ComicType.MANHWA, status: ComicStatus.ONGOING, year: 2024, chapters: 42 },
  { title: "The Tidebound Regent", description: "A deposed queen bargains with the sea for one more tide of power.", author: "Hana Seo", artist: "Hana Seo", genres: ["Action","Fantasy","Regression"], type: ComicType.MANHWA, status: ComicStatus.ONGOING, year: 2025, chapters: 31 },
  { title: "Seven Seals of the Iron Peak", description: "A disgraced disciple must break seven sealed techniques.", author: "Liang Wuxi", artist: "Chen Rui", genres: ["Martial Arts","Action","Adventure"], type: ComicType.MANHUA, status: ComicStatus.ONGOING, year: 2023, chapters: 60 },
  { title: "Midnight Class B", description: "Every school has a night shift.", author: "Aiko Tanabe", artist: "Aiko Tanabe", genres: ["School Life","Mystery","Horror"], type: ComicType.MANGA, status: ComicStatus.COMPLETED, year: 2022, chapters: 64 },
  { title: "Orbit of Small Things", description: "Two lonely engineers on a derelict station learn that love is mostly maintenance.", author: "Jonas Ferreira", artist: "Priya Nair", genres: ["Sci-Fi","Romance","Drama"], type: ComicType.WEBTOON, status: ComicStatus.ONGOING, year: 2025, chapters: 27 },
];

async function main() {
  const perms = ["comic:write", "chapter:write", "user:manage", "review:moderate", "audit:read"];
  for (const key of perms) await db.permission.upsert({ where: { key }, update: {}, create: { key } });
  const all = await db.permission.findMany();
  await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN", permissions: { connect: all.map((p) => ({ id: p.id })) } } });
  for (const name of ["USER", "CREATOR"]) await db.role.upsert({ where: { name }, update: {}, create: { name } });

  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    const role = await db.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
    const adminEmail = process.env.SEED_ADMIN_EMAIL.trim().toLowerCase();
    const passwordHash = await argon2.hash(process.env.SEED_ADMIN_PASSWORD, { type: argon2.argon2id });
    const existingByEmail = await db.user.findUnique({ where: { email: adminEmail } });
    const existingAdminName = await db.user.findUnique({ where: { username: "admin" } });
    if (existingByEmail) {
      await db.user.update({ where: { id: existingByEmail.id }, data: { roleId: role.id, passwordHash, emailVerifiedAt: new Date(), status: "ACTIVE" } });
    } else {
      const username = existingAdminName ? `admin_${Date.now().toString(36)}` : "admin";
      await db.user.create({
        data: { username, email: adminEmail, emailVerifiedAt: new Date(), roleId: role.id, passwordHash, profile: { create: {} } },
      });
    }
  }
  for (const name of GENRES) await db.genre.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });

  for (const c of COMICS) {
    const slug = slugify(c.title);
    if (await db.comic.findUnique({ where: { slug } })) continue;
    await db.comic.create({
      data: {
        slug, title: c.title, altTitle: c.altTitle, description: c.description, author: c.author, artist: c.artist,
        type: c.type, status: c.status, releaseYear: c.year, publishState: "PUBLISHED", views: Math.floor(Math.random() * 90000),
        genres: { create: c.genres.map((g) => ({ genre: { connect: { slug: slugify(g) } } })) },
        chapters: { create: Array.from({ length: c.chapters }, (_, i) => ({
          number: i + 1, title: `Chapter ${i + 1}`, publishState: "PUBLISHED" as const,
          publishedAt: new Date(Date.now() - (c.chapters - i) * 6048e5),
        })) },
      },
    });
  }
  // Example plans (prices in paise). Edit via PUT /api/admin/plans/:id.
  for (const pl of [{ code: "premium_monthly", name: "Premium Monthly", priceMinor: 14900, intervalMonths: 1 }, { code: "premium_yearly", name: "Premium Yearly", priceMinor: 149900, intervalMonths: 12 }])
    await db.subscriptionPlan.upsert({ where: { code: pl.code }, update: {}, create: pl });
  console.log("Seed complete");
}
main().finally(() => db.$disconnect());
