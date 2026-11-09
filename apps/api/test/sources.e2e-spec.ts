import { config } from "dotenv";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

// Uses a fake provider, so no real source is ever contacted. Runs only against a database whose name contains "test".
config({ path: ".env.test" });
if (!/test/i.test(process.env.DATABASE_URL ?? "")) throw new Error("Refusing to run: set DATABASE_URL (in .env.test) to a database whose name contains 'test'.");
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.DISABLE_JOBS = "true";

const origin = "http://localhost:3000";
const stamp = Date.now();
const MANGA = "d86cf65b-5f6c-437d-a0af-19a31f94ec55";
const summary = { id: MANGA, externalId: MANGA, sourceId: "weebcentral", title: "Fake Title", alternativeTitles: [], coverUrl: null, description: null, status: "ongoing", genres: [], contentType: "manhwa", language: "en", sourceUrl: `https://weebcentral.com/series/${MANGA}` };

describe("External sources API (fake provider)", () => {
  let app: INestApplication; let db: PrismaClient; const userEmail = `src-user-${stamp}@example.com`, adminEmail = `src-admin-${stamp}@example.com`;
  const pw = "a-long-test-password-1";
  const anon = () => request(app.getHttpServer());
  let user: ReturnType<typeof request.agent>, admin: ReturnType<typeof request.agent>;
  const send = (a: any, m: "post" | "put" | "delete", url: string, body?: object) => a[m](url).set("Origin", origin).send(body);

  beforeAll(async () => {
    db = new PrismaClient();
    for (const key of ["comic:write", "chapter:write", "user:manage", "review:moderate", "audit:read"]) await db.permission.upsert({ where: { key }, update: {}, create: { key } });
    const perms = await db.permission.findMany();
    const adminRole = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN", permissions: { connect: perms.map((p) => ({ id: p.id })) } } });
    const userRole = await db.role.upsert({ where: { name: "USER" }, update: {}, create: { name: "USER" } });
    const hash = await argon2.hash(pw, { type: argon2.argon2id });
    await db.user.create({ data: { username: `su${stamp}`, email: userEmail, roleId: userRole.id, passwordHash: hash, emailVerifiedAt: new Date() } });
    await db.user.create({ data: { username: `sa${stamp}`, email: adminEmail, roleId: adminRole.id, passwordHash: hash, emailVerifiedAt: new Date() } });

    const { SourceError } = await import("../src/sources/provider.interface");
    const fake = {
      id: "weebcentral", displayName: "WeebCentral",
      info: () => ({ id: "weebcentral", displayName: "WeebCentral", officialUrl: "https://weebcentral.com", attribution: "credit", notes: [], capabilities: { search: true, details: true, chapters: true, pages: true, types: ["manga", "manhwa", "manhua"], languages: ["en"] } }),
      health: async () => ({ ok: true, latencyMs: 3 }),
      search: async (q: any) => {
        if (q.q === "empty") return { items: [], total: 0, page: 1, limit: 20, hasMore: false };
        if (q.q === "slow") throw new SourceError("SOURCE_TIMEOUT", "WeebCentral took too long to respond. Try again in a moment.");
        if (q.q === "down") throw new SourceError("SOURCE_UNAVAILABLE", "WeebCentral could not be reached right now.");
        if (q.type === "novel") throw new SourceError("INVALID_REQUEST", 'WeebCentral does not support the "novel" type.');
        const item = q.q === "reject" ? { ...summary, id: "c1d9a313-51d0-4ea6-9f38-47a8092d7637", externalId: "c1d9a313-51d0-4ea6-9f38-47a8092d7637", title: "Rejected Title" } : summary;
        return { items: [item], total: 1, page: 1, limit: 20, hasMore: false };
      },
      details: async (id: string) => { if (id === "00000000-0000-0000-0000-000000000404") throw new SourceError("NOT_FOUND", "That title or chapter was not found on WeebCentral."); return { ...summary, id, externalId: id, title: id === "c1d9a313-51d0-4ea6-9f38-47a8092d7637" ? "Rejected Title" : summary.title, sourceUrl: `https://weebcentral.com/series/${id}`, authors: [], artists: [], year: null, availableLanguages: ["en"] }; },
      chapters: async () => ({ items: [{ id: "c1", sourceId: "weebcentral", mangaId: MANGA, number: 1, numberLabel: "1", title: null, volume: null, language: "en", publishedAt: null, groups: ["G"], pageCount: 2, sourceUrl: "https://weebcentral.com/chapters/c1", duplicateNumber: false }], total: 1, page: 1, limit: 50, hasMore: false }),
      pages: async () => ({ sourceId: "weebcentral", mangaId: MANGA, chapterId: "c1", chapterTitle: null, chapterNumber: "1", language: "en", pages: [{ pageNumber: 1, imageUrl: "https://official.lowee.us/manga/1.png", width: null, height: null }, { pageNumber: 2, imageUrl: "https://official.lowee.us/manga/2.png", width: null, height: null }], groups: ["G"], sourceUrl: "https://weebcentral.com/chapters/c1" }),
      cover: async () => ({ body: Buffer.from([1, 2, 3]), contentType: "image/png" }),
    };
    const { SOURCES_CONFIG, SOURCE_PROVIDERS } = await import("../src/sources/sources.service");
    const { AppModule } = await import("../src/app.module");
    const { AllExceptionsFilter } = await import("../src/common/errors");
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SOURCES_CONFIG).useValue({ enabled: true, timeoutMs: 5000, userAgent: "ComicVerse-Test/1.0" })
      .overrideProvider(SOURCE_PROVIDERS).useValue([fake]).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use(cookieParser()); app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    user = request.agent(app.getHttpServer()); admin = request.agent(app.getHttpServer());
    expect((await send(user, "post", "/api/auth/login", { email: userEmail, password: pw })).status).toBe(200);
    expect((await send(admin, "post", "/api/auth/login", { email: adminEmail, password: pw })).status).toBe(200);
  });
  afterAll(async () => {
    const sourceTitles = await db.sourceTitle.findMany({ where: { sourceId: "weebcentral", externalId: { in: [MANGA, "c1d9a313-51d0-4ea6-9f38-47a8092d7637"] } }, select: { comicId: true } });
    await db.sourceTitle.deleteMany({ where: { sourceId: "weebcentral", externalId: { in: [MANGA, "c1d9a313-51d0-4ea6-9f38-47a8092d7637"] } } });
    await db.user.deleteMany({ where: { email: { contains: String(stamp) } } });
    const comicIds = sourceTitles.flatMap((title) => title.comicId ? [title.comicId] : []);
    if (comicIds.length) await db.comic.deleteMany({ where: { id: { in: comicIds } } });
    await db.sourceSetting.deleteMany({ where: { sourceId: "weebcentral" } });
    await db.$disconnect(); await app.close();
  });

  it("discovery lists the source and its real capabilities", async () => {
    const r = await anon().get("/api/sources");
    expect(r.status).toBe(200); expect(r.body.enabled).toBe(true); expect(r.body.sources[0].id).toBe("weebcentral");
    expect(r.body.sources[0].capabilities.types).toEqual(["manga", "manhwa", "manhua"]);
    expect((await anon().get("/api/sources/weebcentral")).status).toBe(200);
    expect((await anon().get("/api/sources/weebcentral/health")).status).toBe(401);
    expect((await admin.get("/api/sources/weebcentral/health")).body.ok).toBe(true);
  });
  it("requires admin access for external title discovery", async () => {
    expect((await anon().get("/api/sources/search").query({ q: "fake" })).status).toBe(401);
    expect((await user.get("/api/sources/search").query({ q: "fake" })).status).toBe(403);
    const r = await admin.get("/api/admin/sources/catalog/search").query({ q: "fake", source: "weebcentral", type: "manhwa", page: 1, limit: 20 });
    expect(r.status).toBe(200); expect(r.body.items[0]).toMatchObject({ externalId: MANGA, sourceId: "weebcentral", contentType: "manhwa" });
    expect(r.body.items[0].reviewState).toBeNull();
    expect((await admin.get("/api/admin/sources/catalog/search").query({ q: "empty" })).body.items).toEqual([]);
  });
  it("validates search input and source ids", async () => {
    expect((await admin.get("/api/admin/sources/catalog/search")).status).toBe(400);
    expect((await admin.get("/api/admin/sources/catalog/search").query({ q: "x", limit: 999 })).status).toBe(400);
    expect((await admin.get("/api/admin/sources/catalog/search").query({ q: "x", type: "bad" })).status).toBe(400);
    expect((await admin.get("/api/admin/sources/catalog/search").query({ q: "x", source: "nope" })).status).toBe(404);
    expect((await anon().get("/api/sources/nope")).status).toBe(404);
    expect((await admin.get("/api/admin/sources/catalog/search").query({ q: "x", type: "novel" })).status).toBe(400);
  });
  it("source timeouts and outages become safe errors", async () => {
    const slow = await admin.get("/api/admin/sources/catalog/search").query({ q: "slow" });
    expect(slow.status).toBe(504); expect(JSON.stringify(slow.body)).not.toMatch(/https?:\/\/|stack| at /);
    expect((await admin.get("/api/admin/sources/catalog/search").query({ q: "down" })).status).toBe(503);
  });
  it("details, chapters and pages keep the provider's ids and page order", async () => {
    expect((await anon().get(`/api/sources/weebcentral/manga/${MANGA}`)).status).toBe(404);
    expect((await admin.get(`/api/admin/sources/catalog/weebcentral/${MANGA}`)).body.externalId).toBe(MANGA);
    expect((await admin.get(`/api/admin/sources/catalog/weebcentral/00000000-0000-0000-0000-000000000404`)).status).toBe(404);
    expect((await anon().get(`/api/sources/weebcentral/manga/${MANGA}/chapters`)).status).toBe(404);
    expect((await anon().get(`/api/sources/weebcentral/manga/${MANGA}/chapters/c1/pages`)).status).toBe(404);
  });
  it("covers are served through the backend with safe headers", async () => {
    expect((await anon().get(`/api/sources/weebcentral/cover/${MANGA}/abc.jpg.512.jpg`)).status).toBe(404);
    const r = await admin.get(`/api/admin/sources/weebcentral/cover/${MANGA}/abc.jpg.512.jpg`);
    expect(r.status).toBe(200); expect(r.headers["content-type"]).toMatch(/image\/png/); expect(r.headers["cross-origin-resource-policy"]).toBe("cross-origin"); expect(r.headers["x-content-type-options"]).toBe("nosniff");
  });

  describe("admin title publication", () => {
    it("publishes only after approval and gates public chapter and detail routes", async () => {
      expect((await anon().get("/api/comics/fake-title-weebcentral-d86cf65b")).status).toBe(404);
      expect((await send(user, "post", `/api/admin/sources/catalog/weebcentral/${MANGA}/approve`, { language: "en" })).status).toBe(403);
      const approval = await send(admin, "post", `/api/admin/sources/catalog/weebcentral/${MANGA}/approve`, { language: "en" });
      expect(approval.status).toBe(200);
      expect(approval.body).toMatchObject({ slug: "fake-title-weebcentral-d86cf65b", importedChapters: 1 });
      const comic = await anon().get(`/api/comics/${approval.body.slug}`);
      expect(comic.body).toMatchObject({ title: "Fake Title", type: "MANHWA", publishState: "PUBLISHED" });
      const catalog = await admin.get("/api/admin/sources/catalog/search").query({ q: "fake", source: "weebcentral" });
      expect(catalog.body.items[0]).toMatchObject({ reviewState: "APPROVED", comicSlug: approval.body.slug });
      expect((await anon().get(`/api/sources/weebcentral/manga/${MANGA}`)).body.externalId).toBe(MANGA);
      const sourceChapters = await anon().get(`/api/sources/weebcentral/manga/${MANGA}/chapters`);
      expect(sourceChapters.body.items[0]).toMatchObject({ id: "c1", numberLabel: "1" });
      const chapter = await db.chapter.findFirstOrThrow({ where: { comicId: comic.body.id } });
      expect((await anon().get(`/api/chapters/${chapter.id}`)).body.external).toMatchObject({ sourceId: "weebcentral", mangaId: MANGA, chapterId: "c1" });
      const imagePage = await anon().get(`/api/chapters/${chapter.id}/images`).query({ from: 0, limit: 1 });
      expect(imagePage.body.items[0].url).toContain("official.lowee.us");
      const directPages = await anon().get(`/api/sources/weebcentral/manga/${MANGA}/chapters/c1/pages`);
      expect(directPages.body).toMatchObject({ language: "en", pages: [{ pageNumber: 1 }, { pageNumber: 2 }] });
      await send(user, "post", "/api/user/progress", { comicId: comic.body.id, chapterId: chapter.id, imageIndex: 1, scrollY: 300 });
      expect((await user.get("/api/user/history")).body[0].chapter.id).toBe(chapter.id);
      await send(user, "post", "/api/user/external-library", { sourceId: "weebcentral", externalId: MANGA });
      expect((await user.get("/api/user/external-library")).body).toHaveLength(1);
      expect((await send(admin, "post", `/api/admin/sources/catalog/weebcentral/${MANGA}/unpublish`)).status).toBe(204);
      expect((await anon().get(`/api/comics/${approval.body.slug}`)).status).toBe(404);
      expect((await anon().get(`/api/sources/weebcentral/manga/${MANGA}`)).status).toBe(404);
      expect((await user.get("/api/user/external-library")).body).toHaveLength(0);
      expect((await user.get("/api/user/history")).body).toHaveLength(0);
      expect((await send(admin, "post", `/api/admin/sources/catalog/weebcentral/${MANGA}/republish`)).status).toBe(204);
      expect((await anon().get(`/api/comics/${approval.body.slug}`)).status).toBe(200);
      expect((await user.get("/api/user/history")).body[0]).toMatchObject({ chapter: { id: chapter.id }, imageIndex: 1 });
    });

    it("records rejected titles without publishing them", async () => {
      const id = "c1d9a313-51d0-4ea6-9f38-47a8092d7637";
      expect((await send(admin, "post", `/api/admin/sources/catalog/weebcentral/${id}/reject`, { note: "Not suitable for this catalog." })).status).toBe(204);
      expect((await anon().get(`/api/sources/weebcentral/manga/${id}`)).status).toBe(404);
      const results = await admin.get("/api/admin/sources/catalog/search").query({ q: "reject", source: "weebcentral" });
      expect(results.body.items[0]).toMatchObject({ reviewState: "REJECTED" });
    });
  });

  describe("admin management", () => {
    it("requires an administrator", async () => {
      expect((await anon().get("/api/admin/sources")).status).toBe(401);
      expect((await user.get("/api/admin/sources")).status).toBe(403);
      expect((await send(user, "put", "/api/admin/sources/weebcentral", { enabled: false })).status).toBe(403);
      expect((await send(user, "post", "/api/admin/sources/weebcentral/test")).status).toBe(403);
    });
    it("lists sources without secrets, tests connectivity, renames, disables and re-enables", async () => {
      const l = await admin.get("/api/admin/sources");
      expect(l.status).toBe(200); expect(JSON.stringify(l.body)).not.toMatch(/userAgent|password|secret|key/i);
      expect((await send(admin, "post", "/api/admin/sources/weebcentral/test")).body.ok).toBe(true);
      expect((await send(admin, "put", "/api/admin/sources/weebcentral", { displayName: "AS Test" })).status).toBe(204);
      expect((await anon().get("/api/sources")).body.sources[0].displayName).toBe("AS Test");
      expect((await send(admin, "put", "/api/admin/sources/weebcentral", { enabled: false })).status).toBe(204);
      expect((await admin.get("/api/admin/sources/catalog/search").query({ q: "fake", source: "weebcentral" })).status).toBe(503);
      expect((await anon().get("/api/sources")).body.sources).toEqual([]);
      expect((await send(admin, "put", "/api/admin/sources/weebcentral", { enabled: true })).status).toBe(204);
      expect((await admin.get("/api/admin/sources/catalog/search").query({ q: "fake", source: "weebcentral" })).status).toBe(200);
      expect((await send(admin, "put", "/api/admin/sources/unknown", { enabled: false })).status).toBe(404);
    });
  });

  describe("saved titles", () => {
    it("needs login, never duplicates, and can be removed", async () => {
      expect((await anon().get("/api/user/external-library")).status).toBe(401);
      expect((await send(user, "post", "/api/user/external-library", { sourceId: "weebcentral", externalId: MANGA })).status).toBe(200);
      expect((await send(user, "post", "/api/user/external-library", { sourceId: "weebcentral", externalId: MANGA })).status).toBe(200);
      const list = await user.get("/api/user/external-library");
      expect(list.body).toHaveLength(1); expect(list.body[0]).toMatchObject({ sourceId: "weebcentral", externalId: MANGA, title: "Fake Title" });
      expect(Object.keys(list.body[0])).not.toContain("pages"); // metadata only
      expect((await user.get(`/api/user/external-library/weebcentral/${MANGA}`)).body.saved).toBe(true);
      expect((await send(user, "delete", `/api/user/external-library/weebcentral/${MANGA}`)).status).toBe(204);
      expect((await user.get("/api/user/external-library")).body).toHaveLength(0);
    });
    it("refuses to save a title from an unknown source", async () => {
      expect((await send(user, "post", "/api/user/external-library", { sourceId: "nope", externalId: MANGA })).status).toBe(404);
    });
  });
});
