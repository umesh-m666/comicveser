import { config } from "dotenv";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

// These tests create and delete real rows, so they only run against a database whose name contains "test".
config({ path: ".env.test" });
if (!/test/i.test(process.env.DATABASE_URL ?? "")) throw new Error("Refusing to run: set DATABASE_URL (in .env.test) to a database whose name contains 'test'.");
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.DISABLE_JOBS = "true";

const origin = "http://localhost:3000";
const stamp = Date.now();
const user = { username: `u${stamp}`, email: `api-user-${stamp}@example.com`, password: "correct-horse-battery" };
const adminEmail = `api-admin-${stamp}@example.com`, adminPassword = "admin-password-for-tests";

describe("ComicVerse API", () => {
  let app: INestApplication; let db: PrismaClient;
  let userId = "", seedComicId = "", seedChapterId = "";
  const anon = () => request(app.getHttpServer());
  let userAgent: ReturnType<typeof request.agent>, adminAgent: ReturnType<typeof request.agent>;
  const post = (a: any, url: string, body?: object) => a.post(url).set("Origin", origin).send(body);
  const put = (a: any, url: string, body?: object) => a.put(url).set("Origin", origin).send(body);

  beforeAll(async () => {
    db = new PrismaClient();
    for (const key of ["comic:write", "chapter:write", "user:manage", "review:moderate", "audit:read"]) await db.permission.upsert({ where: { key }, update: {}, create: { key } });
    const perms = await db.permission.findMany();
    const adminRole = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN", permissions: { connect: perms.map((p) => ({ id: p.id })) } } });
    await db.role.upsert({ where: { name: "USER" }, update: {}, create: { name: "USER" } });
    await db.user.create({ data: { username: `a${stamp}`, email: adminEmail, emailVerifiedAt: new Date(), roleId: adminRole.id, passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }) } });
    const comic = await db.comic.create({ data: { slug: `api-test-${stamp}`, title: `API Test ${stamp}`, description: "fixture", author: "t", artist: "t", type: "MANGA", releaseYear: 2026, publishState: "PUBLISHED" } });
    const ch = await db.chapter.create({ data: { comicId: comic.id, number: 1, title: "One", publishState: "PUBLISHED", publishedAt: new Date() } });
    seedComicId = comic.id; seedChapterId = ch.id;

    const { AppModule } = await import("../src/app.module");
    const { AllExceptionsFilter } = await import("../src/common/errors");
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use(cookieParser()); app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    userAgent = request.agent(app.getHttpServer()); adminAgent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { contains: String(stamp) } } });
    await db.comic.deleteMany({ where: { slug: { contains: String(stamp) } } });
    await db.$disconnect(); await app.close();
  });

  it("reports health", async () => { const r = await anon().get("/api/health"); expect(r.status).toBe(200); expect(r.body.status).toBe("ok"); });

  describe("registration and login", () => {
    it("rejects mismatched passwords and bad usernames", async () => {
      expect((await post(anon(), "/api/auth/register", { ...user, confirmPassword: "different-password" })).status).toBe(400);
      expect((await post(anon(), "/api/auth/register", { ...user, username: "no spaces!", confirmPassword: user.password })).status).toBe(400);
    });
    it("registers, then refuses a duplicate email", async () => {
      const ok = await post(anon(), "/api/auth/register", { ...user, confirmPassword: user.password });
      expect(ok.status).toBe(201); userId = ok.body.id; expect(ok.body.passwordHash).toBeUndefined();
      expect((await post(anon(), "/api/auth/register", { ...user, username: `x${stamp}`, confirmPassword: user.password })).status).toBe(409);
    });
    it("rejects unknown fields (no privilege escalation by extra properties)", async () => {
      const r = await post(anon(), "/api/auth/register", { ...user, username: `y${stamp}`, email: `y${stamp}@example.com`, confirmPassword: user.password, role: "ADMIN" });
      expect(r.status).toBe(400);
    });
    it("gives one generic message for a wrong password", async () => {
      const r = await post(anon(), "/api/auth/login", { email: user.email, password: "wrong-password-here" });
      expect(r.status).toBe(401); expect(r.body.error.message).toBe("Email or password is incorrect.");
    });
    it("logs in with an HTTP-only cookie and never exposes the hash", async () => {
      const r = await post(userAgent, "/api/auth/login", { email: user.email, password: user.password });
      expect(r.status).toBe(200); expect(String(r.headers["set-cookie"])).toMatch(/cv_session=.*HttpOnly/);
      const me = await userAgent.get("/api/auth/me");
      expect(me.status).toBe(200); expect(me.body.email).toBe(user.email); expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|argon2/);
    });
  });

  describe("CSRF origin check", () => {
    it("blocks a state-changing request without the web origin, even when logged in", async () => {
      const r = await userAgent.post("/api/user/bookmarks").send({ comicId: seedComicId });
      expect(r.status).toBe(403);
    });
  });

  describe("bookmarks and reading progress", () => {
    it("bookmarks idempotently and removes", async () => {
      expect((await post(userAgent, "/api/user/bookmarks", { comicId: seedComicId })).status).toBe(204);
      expect((await post(userAgent, "/api/user/bookmarks", { comicId: seedComicId })).status).toBe(204);
      expect((await userAgent.get("/api/user/bookmarks")).body.total).toBe(1);
      expect((await userAgent.delete(`/api/user/bookmarks/${seedComicId}`).set("Origin", origin)).status).toBe(204);
      expect((await userAgent.get("/api/user/bookmarks")).body.total).toBe(0);
    });
    it("saves and returns progress, and rejects a chapter from another comic", async () => {
      expect((await post(userAgent, "/api/user/progress", { comicId: seedComicId, chapterId: seedChapterId, imageIndex: 2, scrollY: 100 })).status).toBe(204);
      const h = await userAgent.get("/api/user/history");
      expect(h.body).toHaveLength(1); expect(h.body[0].imageIndex).toBe(2);
      expect((await post(userAgent, "/api/user/progress", { comicId: seedComicId, chapterId: "not-a-real-chapter-id", imageIndex: 0, scrollY: 0 })).status).toBe(400);
    });
  });

  describe("authorization", () => {
    it("401 for anonymous, 403 for a normal user", async () => {
      expect((await anon().get("/api/admin/dashboard")).status).toBe(401);
      expect((await userAgent.get("/api/admin/dashboard")).status).toBe(403);
      expect((await post(userAgent, "/api/admin/comics", { title: "x", description: "x", author: "x", artist: "x", type: "MANGA", releaseYear: 2026, genreSlugs: [] })).status).toBe(403);
    });
  });

  describe("admin publishing", () => {
    let slug = "", comicId = "";
    it("creates a draft that is hidden, then visible once published", async () => {
      expect((await post(adminAgent, "/api/auth/login", { email: adminEmail, password: adminPassword })).status).toBe(200);
      const c = await post(adminAgent, "/api/admin/comics", { title: `Admin Made ${stamp}`, description: "d", author: "a", artist: "a", type: "MANGA", releaseYear: 2026, genreSlugs: [] });
      expect(c.status).toBe(201); slug = c.body.slug; comicId = c.body.id;
      expect((await anon().get(`/api/comics/${slug}`)).status).toBe(404);
      expect((await put(adminAgent, `/api/admin/comics/${comicId}`, { publishState: "PUBLISHED" })).status).toBe(200);
      expect((await anon().get(`/api/comics/${slug}`)).body.title).toBe(`Admin Made ${stamp}`);
    });
    it("refuses to publish a chapter with no pages", async () => {
      const ch = await post(adminAgent, "/api/admin/chapters", { comicId, number: 1, title: "One" });
      expect(ch.status).toBe(201);
      const r = await put(adminAgent, `/api/admin/chapters/${ch.body.id}`, { publishState: "PUBLISHED" });
      expect(r.status).toBe(400); expect(r.body.error.message).toMatch(/at least one image/i);
    });
    it("records the actions in the audit log", async () => {
      const logs = await adminAgent.get("/api/admin/audit-logs");
      expect(logs.status).toBe(200); expect(logs.body.items.some((l: any) => l.action === "comic.create")).toBe(true);
    });
  });

  describe("ratings and reviews", () => {
    it("requires a verified email to review", async () => {
      expect((await post(userAgent, `/api/comics/${seedComicId}/reviews`, { body: "A review that is long enough." })).status).toBe(403);
    });
    it("validates the rating range and keeps one rating per user", async () => {
      expect((await put(userAgent, `/api/comics/${seedComicId}/rating`, { value: 11 })).status).toBe(400);
      expect((await put(userAgent, `/api/comics/${seedComicId}/rating`, { value: 8 })).status).toBe(204);
      expect((await put(userAgent, `/api/comics/${seedComicId}/rating`, { value: 9 })).status).toBe(204);
      const r = await anon().get(`/api/comics/${seedComicId}/reviews`);
      expect(r.body.ratingCount).toBe(1); expect(r.body.average).toBe(9);
    });
  });

  describe("account deletion", () => {
    it("needs the right password, then removes personal data and blocks login", async () => {
      const email = `api-del-${stamp}@example.com`;
      const role = await db.role.findUniqueOrThrow({ where: { name: "USER" } });
      const u = await db.user.create({ data: { username: `d${stamp}`, email, roleId: role.id, passwordHash: await argon2.hash("delete-me-please-1", { type: argon2.argon2id }) } });
      const agent = request.agent(app.getHttpServer());
      expect((await post(agent, "/api/auth/login", { email, password: "delete-me-please-1" })).status).toBe(200);
      expect((await agent.delete("/api/user/account").set("Origin", origin).send({ password: "wrong-password-x" })).status).toBe(401);
      expect((await agent.delete("/api/user/account").set("Origin", origin).send({ password: "delete-me-please-1" })).status).toBe(204);
      expect((await agent.get("/api/auth/me")).status).toBe(401);
      const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(row.email).toMatch(/@deleted\.invalid$/); expect(row.deletedAt).not.toBeNull();
      expect((await post(anon(), "/api/auth/login", { email, password: "delete-me-please-1" })).status).toBe(401);
    });
  });

  describe("errors and account suspension", () => {
    it("returns a clean error body with no stack trace", async () => {
      const r = await anon().get("/api/comics/definitely-not-here");
      expect(r.status).toBe(404); expect(r.body.error.statusCode).toBe(404); expect(JSON.stringify(r.body)).not.toMatch(/stack|at .*\(/);
    });
    it("signs a suspended user out immediately", async () => {
      expect((await put(adminAgent, `/api/admin/users/${userId}/status`, { status: "SUSPENDED" })).status).toBe(204);
      expect((await userAgent.get("/api/auth/me")).status).toBe(401);
    });
  });
});
