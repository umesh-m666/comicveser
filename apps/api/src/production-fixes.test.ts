import { test } from "node:test";
import assert from "node:assert/strict";
import { isOriginAllowed, sessionCookieOptions, webOrigins } from "./common/config";
import { extractCandidateTokens, OriginGuard, SESSION_COOKIE, SessionGuard } from "./auth/auth.guard";
import { GoogleTokenVerifier } from "./auth/google-token.verifier";
import { AuthService } from "./auth/auth.service";
import { MailService } from "./mail/mail.service";
import { ReviewsService } from "./reviews/reviews.service";
import { AdminService } from "./admin/admin.service";
import { NotificationsService } from "./notifications/notifications.service";
import { SourcesService } from "./sources/sources.service";
import { loadSourcesConfig } from "./sources/sources.config";
import { sha256 } from "./common/crypto";

function createInMemoryPrisma() {
  const roles = new Map<string, any>([
    [
      "role-user",
      { id: "role-user", name: "USER", permissions: [{ key: "comic:read" }] },
    ],
    [
      "role-admin",
      {
        id: "role-admin",
        name: "ADMIN",
        permissions: [
          { key: "comic:read" },
          { key: "comic:write" },
          { key: "chapter:write" },
          { key: "review:moderate" },
          { key: "audit:read" },
          { key: "user:manage" },
        ],
      },
    ],
  ]);

  const users = new Map<string, any>();
  const profiles = new Map<string, any>();
  const sessions = new Map<string, any>();
  const authTokens = new Map<string, any>();
  const reports = new Map<string, any>();
  const notifications: any[] = [];
  const auditLogs: any[] = [];
  const comics = new Map<string, any>();
  const chapters = new Map<string, any>();
  const sourceTitles = new Map<string, any>();
  const sourceChapters = new Map<string, any>();

  let seq = 1;
  const nextId = (prefix: string) => `${prefix}-${seq++}`;

  const hydrateUser = (u: any, include?: any) => {
    if (!u) return null;
    const copy = { ...u };
    if (include?.role) {
      copy.role = roles.get(u.roleId) ?? { id: u.roleId, name: "USER", permissions: [] };
    }
    if (include?.profile) {
      copy.profile = profiles.get(u.id) ?? null;
    }
    return copy;
  };

  const db: any = {
    _stores: { users, sessions, authTokens, reports, notifications, auditLogs, comics, chapters, sourceTitles, sourceChapters },
    $transaction: async (arg: any) => {
      if (typeof arg === "function") return arg(db);
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    },
    $executeRawUnsafe: async () => 1,
    $queryRawUnsafe: async () => [],
    setSourceTitleRole: async () => {},
    getSourceTitleRolesByIds: async (ids: string[]) => new Map(ids.map((id) => [id, "PRIMARY"])),
    role: {
      findUnique: async ({ where }: any) => {
        for (const r of roles.values()) {
          if (r.name === where.name || r.id === where.id) return r;
        }
        return null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const found = await db.role.findUnique({ where });
        if (!found) throw new Error(`Role not found: ${JSON.stringify(where)}`);
        return found;
      },
      create: async ({ data }: any) => {
        const r = { id: nextId("role"), name: data.name, permissions: [] };
        roles.set(r.id, r);
        return r;
      },
    },
    user: {
      count: async () => [...users.values()].filter((u) => !u.deletedAt).length,
      create: async ({ data, include }: any) => {
        const id = data.id ?? nextId("user");
        const u = {
          id,
          username: data.username,
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash,
          googleId: data.googleId ?? null,
          authProvider: data.authProvider ?? "local",
          emailVerifiedAt: data.emailVerifiedAt ?? null,
          status: data.status ?? "ACTIVE",
          roleId: data.roleId,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };
        users.set(id, u);
        if (data.profile?.create) {
          profiles.set(id, { userId: id, avatarUrl: data.profile.create.avatarUrl ?? null });
        }
        return hydrateUser(u, include);
      },
      findFirst: async ({ where, include }: any) => {
        for (const u of users.values()) {
          if (where?.deletedAt === null && u.deletedAt !== null) continue;
          if (where?.email && u.email !== where.email.toLowerCase()) continue;
          if (where?.googleId && u.googleId !== where.googleId) continue;
          return hydrateUser(u, include);
        }
        return null;
      },
      findUnique: async ({ where, include }: any) => {
        for (const u of users.values()) {
          if (where.id && u.id === where.id) return hydrateUser(u, include);
          if (where.username && u.username === where.username) return hydrateUser(u, include);
          if (where.email && u.email === where.email.toLowerCase()) return hydrateUser(u, include);
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        const list: any[] = [];
        for (const u of users.values()) {
          if (where?.deletedAt === null && u.deletedAt !== null) continue;
          if (where?.status && u.status !== where.status) continue;
          if (where?.role?.name) {
            const r = roles.get(u.roleId);
            if (r?.name !== where.role.name) continue;
          }
          list.push(hydrateUser(u, { role: true, profile: true }));
        }
        return list;
      },
      update: async ({ where, data, include }: any) => {
        const u = users.get(where.id);
        if (!u) throw new Error("User not found");
        Object.assign(u, data, { updatedAt: new Date() });
        return hydrateUser(u, include);
      },
    },
    userProfile: {
      upsert: async ({ where, update, create }: any) => {
        const existing = profiles.get(where.userId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { ...create };
        profiles.set(where.userId, created);
        return created;
      },
      findUnique: async ({ where }: any) => profiles.get(where.userId) ?? null,
    },
    session: {
      create: async ({ data }: any) => {
        const s = { id: nextId("sess"), ...data, createdAt: new Date() };
        sessions.set(s.tokenHash, s);
        return s;
      },
      findUnique: async ({ where, include }: any) => {
        const s = sessions.get(where.tokenHash);
        if (!s) return null;
        if (include?.user) {
          return {
            ...s,
            user: hydrateUser(users.get(s.userId), { role: true, profile: true }),
          };
        }
        return s;
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [k, s] of sessions.entries()) {
          if ((where.id && s.id === where.id) || (where.userId && s.userId === where.userId)) {
            sessions.delete(k);
            count++;
          }
        }
        return { count };
      },
      groupBy: async () => [...new Set([...sessions.values()].map((s) => s.userId))].map((userId) => ({ userId })),
    },
    authToken: {
      create: async ({ data }: any) => {
        const t = { id: nextId("tok"), ...data, usedAt: null, createdAt: new Date() };
        authTokens.set(t.tokenHash, t);
        return t;
      },
      findUnique: async ({ where, include }: any) => {
        const t = authTokens.get(where.tokenHash);
        if (!t) return null;
        if (include?.user) return { ...t, user: users.get(t.userId) };
        return t;
      },
      update: async ({ where, data }: any) => {
        for (const t of authTokens.values()) {
          if (t.id === where.id) {
            Object.assign(t, data);
            return t;
          }
        }
        throw new Error("Token not found");
      },
    },
    report: {
      create: async ({ data }: any) => {
        const id = nextId("rep");
        const reporter = users.get(data.reporterId);
        const row = {
          id,
          reporterId: data.reporterId,
          reporter: reporter ? { id: reporter.id, username: reporter.username, email: reporter.email } : null,
          targetType: data.targetType,
          targetId: data.targetId,
          category: data.category ?? "GENERAL",
          subject: data.subject ?? "",
          description: data.description ?? data.reason ?? "",
          reason: data.reason,
          comicId: data.comicId ?? null,
          chapterId: data.chapterId ?? null,
          status: "OPEN",
          isRead: Boolean(data.isRead),
          adminResponse: null,
          respondedAt: null,
          respondedById: null,
          createdAt: new Date(),
          resolvedAt: null,
        };
        reports.set(id, row);
        return row;
      },
      findUnique: async ({ where }: any) => reports.get(where.id) ?? null,
      findMany: async ({ where }: any = {}) => {
        let arr = [...reports.values()];
        if (where?.reporterId) arr = arr.filter((r) => r.reporterId === where.reporterId);
        if (where?.status) arr = arr.filter((r) => r.status === where.status);
        return arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },
      count: async ({ where }: any = {}) => {
        let arr = [...reports.values()];
        if (where?.status) arr = arr.filter((r) => r.status === where.status);
        if (where?.isRead !== undefined) arr = arr.filter((r) => Boolean(r.isRead) === where.isRead);
        return arr.length;
      },
      update: async ({ where, data }: any) => {
        const row = reports.get(where.id);
        if (!row) throw new Error("Report not found");
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const row = reports.get(where.id);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    notification: {
      create: async ({ data }: any) => {
        const n = { id: nextId("notif"), ...data, readAt: null, createdAt: new Date() };
        notifications.push(n);
        return n;
      },
      count: async ({ where }: any = {}) =>
        notifications.filter((n) => (!where.userId || n.userId === where.userId) && (where.readAt === undefined || n.readAt === where.readAt)).length,
      findMany: async ({ where }: any = {}) =>
        notifications.filter((n) => !where.userId || n.userId === where.userId),
    },
    auditLog: {
      create: async ({ data }: any) => {
        const entry = { id: nextId("audit"), ...data, createdAt: new Date() };
        auditLogs.push(entry);
        return entry;
      },
      count: async () => auditLogs.length,
      findMany: async () => auditLogs,
    },
    comic: {
      count: async () => [...comics.values()].filter((c) => !c.deletedAt).length,
      findMany: async () => [...comics.values()].filter((c) => !c.deletedAt),
      findUnique: async ({ where }: any) => {
        for (const c of comics.values()) {
          if ((where.id && c.id === where.id) || (where.slug && c.slug === where.slug)) return c;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const c = { id: nextId("comic"), views: 0, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        comics.set(c.id, c);
        return c;
      },
      update: async ({ where, data }: any) => {
        const c = comics.get(where.id);
        Object.assign(c, data);
        return c;
      },
    },
    chapter: {
      count: async () => [...chapters.values()].filter((c) => !c.deletedAt).length,
      findMany: async ({ where }: any = {}) =>
        [...chapters.values()].filter((c) => (!where?.comicId || c.comicId === where.comicId) && (where?.deletedAt === undefined || c.deletedAt === where.deletedAt)),
      deleteMany: async () => ({ count: 0 }),
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: any) => {
        // Enforce @@unique([comicId, number]) just like PostgreSQL!
        for (const existing of chapters.values()) {
          if (existing.comicId === data.comicId && existing.number === data.number) {
            const err: any = new Error("Unique constraint failed on the fields: (`comicId`,`number`)");
            err.code = "P2002";
            throw err;
          }
        }
        const chId = nextId("ch");
        const ch: any = {
          id: chId,
          comicId: data.comicId,
          number: data.number,
          title: data.title,
          publishState: data.publishState,
          publishedAt: data.publishedAt,
          deletedAt: null,
          createdAt: new Date(),
          comic: comics.get(data.comicId) ?? { title: "Comic" },
        };
        if (data.sourceChapter?.create) {
          const sc = { id: nextId("sc"), chapterId: chId, ...data.sourceChapter.create };
          sourceChapters.set(`${sc.sourceTitleId}:${sc.externalId}`, sc);
          ch.sourceChapter = sc;
        }
        chapters.set(chId, ch);
        return ch;
      },
    },
    readingHistory: {
      count: async () => 0,
    },
    sourceSetting: {
      findUnique: async () => null,
      findMany: async () => [],
    },
    sourceTitle: {
      findUnique: async ({ where }: any) => {
        if (where.sourceId_externalId) {
          return sourceTitles.get(`${where.sourceId_externalId.sourceId}:${where.sourceId_externalId.externalId}`) ?? null;
        }
        for (const st of sourceTitles.values()) {
          if (st.id === where.id) return st;
        }
        return null;
      },
      delete: async ({ where }: any) => {
        for (const [k, st] of sourceTitles.entries()) {
          if (st.id === where.id) sourceTitles.delete(k);
        }
      },
      deleteMany: async () => ({ count: 0 }),
      upsert: async ({ where, update, create }: any) => {
        const key = `${where.sourceId_externalId.sourceId}:${where.sourceId_externalId.externalId}`;
        const existing = sourceTitles.get(key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { id: nextId("st"), ...create };
        sourceTitles.set(key, created);
        return created;
      },
    },
    sourceChapter: {
      findUnique: async ({ where }: any) => {
        if (where.sourceTitleId_externalId) {
          return sourceChapters.get(`${where.sourceTitleId_externalId.sourceTitleId}:${where.sourceTitleId_externalId.externalId}`) ?? null;
        }
        return null;
      },
    },
  };
  return db;
}

test("Cross-origin cookie configuration, OriginGuard, and dual Cookie + Bearer SessionGuard", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevOrigin = process.env.WEB_ORIGIN;
  const prevSameSite = process.env.COOKIE_SAMESITE;

  try {
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = "https://comicverse-web.onrender.com, https://comicverse.vercel.app/";
    delete process.env.COOKIE_SAMESITE;

    assert.deepEqual(webOrigins(), [
      "https://comicverse-web.onrender.com",
      "https://comicverse.vercel.app",
    ]);
    assert.equal(isOriginAllowed("https://comicverse-web.onrender.com"), true);
    assert.equal(isOriginAllowed("https://comicverse.vercel.app"), true);
    assert.equal(isOriginAllowed("https://evil.example.com"), false);

    // Cross-origin request from Render frontend to Render backend must get SameSite=None; Secure; HttpOnly
    const cookieOpts = sessionCookieOptions(
      {
        headers: {
          origin: "https://comicverse-web.onrender.com",
          host: "comicverse-api.onrender.com",
          "x-forwarded-proto": "https",
        },
      } as any,
      60_000,
    );
    assert.equal(cookieOpts.httpOnly, true);
    assert.equal(cookieOpts.secure, true);
    assert.equal(cookieOpts.sameSite, "none");
    assert.equal(cookieOpts.path, "/");

    // Extract candidate tokens supports both Authorization Bearer and cv_session cookie
    const tokens = extractCandidateTokens({
      cookies: { [SESSION_COOKIE]: "cookie-tok" },
      headers: { authorization: "Bearer bearer-tok" },
    });
    assert.deepEqual(tokens, ["bearer-tok", "cookie-tok"]);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.WEB_ORIGIN = prevOrigin;
    process.env.COOKIE_SAMESITE = prevSameSite;
  }
});

test("Authentication: email/password login, verification, password reset, Google registration, account linking, and ADMIN role preservation", async () => {
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";
  const db = createInMemoryPrisma();
  const sentEmails: Array<{ to: string; subject: string; text: string; html?: string }> = [];
  const mail = new MailService();
  mail.setCustomTransport(async (msg) => {
    sentEmails.push(msg);
    return { id: `mail-${sentEmails.length}` };
  });

  const verifier = new GoogleTokenVerifier();
  verifier.setCustomVerifier(async (idToken) => {
    const parsed = JSON.parse(idToken);
    return {
      sub: parsed.sub,
      email: parsed.email,
      emailVerified: true,
      name: parsed.name,
      picture: parsed.picture,
    };
  });

  const auth = new AuthService(db, mail, verifier);
  const sessionGuard = new SessionGuard(db);

  // 1. Register a regular user with email & password
  const reg = await auth.register({
    username: "umesh_reader",
    email: "umesh@example.com",
    password: "StrongPassword123!",
    confirmPassword: "StrongPassword123!",
  });
  assert.equal(reg.username, "umesh_reader");
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /Verify your ComicVerse email/i);

  // Extract verification token from email and verify
  const verifyToken = sentEmails[0].text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(verifyToken);
  await auth.verifyEmail(verifyToken);

  // 2. Email/password login + session persistence via both cookie and Bearer token
  const loginRes = await auth.login(
    { email: "umesh@example.com", password: "StrongPassword123!" },
    "Playwright-Test-Agent",
  );
  assert.ok(loginRes.token);
  assert.equal(loginRes.user.username, "umesh_reader");
  assert.equal(loginRes.user.role, "USER");
  assert.equal(loginRes.user.emailVerified, true);

  // Verify SessionGuard accepts Bearer token when cross-origin cookie is blocked
  const mockReqBearer: any = {
    cookies: {},
    headers: { authorization: `Bearer ${loginRes.token}` },
  };
  const guardOk = await sessionGuard.canActivate({
    switchToHttp: () => ({ getRequest: () => mockReqBearer }),
  } as any);
  assert.equal(guardOk, true);
  assert.equal(mockReqBearer.user.username, "umesh_reader");

  // 3. Google login for existing email user links account and preserves role
  const googleLinked = await auth.googleLogin({
    credential: JSON.stringify({
      sub: "google-sub-umesh-1",
      email: "umesh@example.com",
      name: "Umesh M",
      picture: "https://lh3.googleusercontent.com/a/avatar1",
    }),
  });
  assert.equal(googleLinked.isNewUser, false);
  assert.equal(googleLinked.user.id, reg.id);
  assert.equal(googleLinked.user.role, "USER");

  // 4. Google registration for brand-new user creates USER account (never ADMIN)
  const googleNew = await auth.googleLogin({
    credential: JSON.stringify({
      sub: "google-sub-new-2",
      email: "newgoogleuser@gmail.com",
      name: "New Google Reader",
      picture: "https://lh3.googleusercontent.com/a/avatar2",
    }),
  });
  assert.equal(googleNew.isNewUser, true);
  assert.equal(googleNew.user.email, "newgoogleuser@gmail.com");
  assert.equal(googleNew.user.role, "USER");
  assert.equal(googleNew.user.emailVerified, true);

  // 5. Admin account logging in via Google preserves ADMIN role and all admin permissions
  const adminUser = await db.user.create({
    data: {
      username: "site_admin",
      email: "admin@comicverse.app",
      passwordHash: "unused",
      roleId: "role-admin",
      emailVerifiedAt: new Date(),
    },
    include: { role: true },
  });
  const adminGoogle = await auth.googleLogin({
    credential: JSON.stringify({
      sub: "google-sub-admin-99",
      email: "admin@comicverse.app",
      name: "Site Admin",
    }),
  });
  assert.equal(adminGoogle.isNewUser, false);
  assert.equal(adminGoogle.user.id, adminUser.id);
  assert.equal(adminGoogle.user.role, "ADMIN");
  assert.ok(adminGoogle.user.permissions.includes("comic:write"));
  assert.ok(adminGoogle.user.permissions.includes("review:moderate"));

  // 6. Password reset flow invalidates old sessions and sends confirmation email
  await auth.forgot("umesh@example.com");
  const resetEmail = sentEmails.find((e) => /Reset your ComicVerse password/i.test(e.subject));
  assert.ok(resetEmail);
  const resetToken = resetEmail.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(resetToken);
  await auth.reset(resetToken, "BrandNewPass456!");

  const relogin = await auth.login({ email: "umesh@example.com", password: "BrandNewPass456!" });
  assert.ok(relogin.token);

  // 7. Logout invalidates session
  const sessionRow = db._stores.sessions.get(sha256(relogin.token));
  assert.ok(sessionRow);
  await auth.logout(sessionRow.id);
  assert.equal(db._stores.sessions.get(sha256(relogin.token)), undefined);
});

test("User Issue Reporting -> Admin Notifications, Dashboard Metrics, Filtering, and Admin Response to User", async () => {
  const db = createInMemoryPrisma();
  const mail = new MailService();
  const sentEmails: any[] = [];
  mail.setCustomTransport(async (msg) => {
    sentEmails.push(msg);
    return { id: "ok" };
  });
  const notif = new NotificationsService(db);
  const reviews = new ReviewsService(db, notif, mail);
  const adminSvc = new AdminService(db, {} as any, undefined, undefined, mail, notif);

  // Seed 1 admin and 1 reader
  const admin = await db.user.create({
    data: {
      username: "admin",
      email: "admin@comicverse.app",
      passwordHash: "hash",
      roleId: "role-admin",
      emailVerifiedAt: new Date(),
    },
  });
  const reader = await db.user.create({
    data: {
      username: "reader_one",
      email: "reader1@example.com",
      passwordHash: "hash",
      roleId: "role-user",
      emailVerifiedAt: new Date(),
    },
  });

  // 1. Reader submits an issue report
  const submitted = await reviews.report(
    {
      id: reader.id,
      username: reader.username,
      email: reader.email,
      role: "USER",
      permissions: ["comic:read"],
      emailVerified: true,
      sessionId: "s1",
    },
    {
      targetType: "chapter",
      targetId: "ch-101",
      comicId: "comic-lookism",
      chapterId: "ch-101",
      category: "BROKEN_CHAPTER",
      subject: "Episode 27 pages not loading",
      description: "Episode 27 on WeebCentral shows missing page 4.",
    },
  );

  assert.equal(submitted.category, "BROKEN_CHAPTER");
  assert.equal(submitted.subject, "Episode 27 pages not loading");
  assert.equal(submitted.status, "OPEN");
  assert.equal(submitted.isRead, false);

  // 2. Verify Admin received an unread notification + email alert
  const adminNotifs = await notif.list(admin.id, 1);
  assert.equal(adminNotifs.unread, 1);
  assert.match(adminNotifs.items[0].title, /New Issue Report \(BROKEN_CHAPTER\)/);

  // 3. Verify Admin Dashboard includes the new unread issue report
  const dash = await adminSvc.dashboard();
  assert.equal(dash.totals.pendingReports, 1);
  assert.equal(dash.issueReports.open, 1);
  assert.equal(dash.issueReports.unread, 1);
  assert.equal(dash.issueReports.recent[0].subject, "Episode 27 pages not loading");

  // 4. Verify Admin Reports filtering & search
  const filtered = await adminSvc.reports({
    page: 1,
    category: "BROKEN_CHAPTER",
    unreadOnly: "true",
    q: "Episode 27",
  });
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.summary.open, 1);
  assert.equal(filtered.summary.unread, 1);

  // 5. Admin responds to and resolves the issue report
  const resolved = await adminSvc.resolveReport(
    submitted.id,
    {
      status: "RESOLVED",
      adminResponse: "Fixed! Episode 27 images have been re-synced from WeebCentral.",
    },
    admin.id,
  );
  assert.equal(resolved.status, "RESOLVED");

  // 6. Verify Reader sees the resolved status & Admin response in /reports/mine AND received an in-app notification
  const mine = await reviews.myReports(reader.id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, "RESOLVED");
  assert.equal(mine[0].adminResponse, "Fixed! Episode 27 images have been re-synced from WeebCentral.");

  const readerNotifs = await notif.list(reader.id, 1);
  assert.equal(readerNotifs.unread, 1);
  assert.match(readerNotifs.items[0].title, /Admin responded to your report/);
});

test("WeebCentral Admin Publishing handles Episode/Chapter formats, duplicate chapter numbers, and special chapters without P2002 error", async () => {
  const db = createInMemoryPrisma();
  const cache: any = { get: async () => null, set: async () => {}, delete: async () => {}, wrap: async (_k: string, _ttl: number, fn: () => any) => fn() };
  const cfg = loadSourcesConfig({ SOURCES_ENABLED: "true" });

  const mockWeebCentralProvider: any = {
    id: "weebcentral",
    info: () => ({
      id: "weebcentral",
      name: "WeebCentral",
      officialUrl: "https://weebcentral.com",
      capabilities: { search: true, details: true, chapters: true, pages: true, languages: ["en"], types: ["manga", "manhwa", "manhua"] },
    }),
    details: async (externalId: string) => ({
      id: externalId,
      externalId,
      sourceId: "weebcentral",
      title: "Official Lookism",
      alternativeTitles: ["Lookism"],
      coverUrl: "https://temp.compsci88.com/cover/lookism.webp",
      description: "A high school story.",
      status: "ongoing",
      genres: ["Action"],
      contentType: "unknown", // Should fallback cleanly to MANGA instead of throwing BadRequestException
      language: "en",
      sourceUrl: `https://weebcentral.com/series/${externalId}/Lookism`,
      authors: [],
      artists: [],
      year: null,
      availableLanguages: ["en"],
    }),
    chapters: async (externalId: string) => ({
      items: [
        {
          id: "01J76XYY77SY7EJ5AJ2S52J001",
          sourceId: "weebcentral",
          mangaId: externalId,
          number: 1,
          numberLabel: "1",
          title: null,
          volume: null,
          language: "en",
          publishedAt: "2025-05-01T00:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52J001",
          duplicateNumber: false,
        },
        {
          id: "01J76XYY77SY7EJ5AJ2S52J015A",
          sourceId: "weebcentral",
          mangaId: externalId,
          number: 15,
          numberLabel: "15",
          title: "Version A",
          volume: null,
          language: "en",
          publishedAt: "2025-05-02T00:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52J015A",
          duplicateNumber: true,
        },
        {
          id: "01J76XYY77SY7EJ5AJ2S52J015B",
          sourceId: "weebcentral",
          mangaId: externalId,
          number: 15, // Duplicate chapter number 15!
          numberLabel: "15",
          title: "Version B",
          volume: null,
          language: "en",
          publishedAt: "2025-05-02T00:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52J015B",
          duplicateNumber: true,
        },
        {
          id: "01J76XYY77SY7EJ5AJ2S52J155",
          sourceId: "weebcentral",
          mangaId: externalId,
          number: 15.5,
          numberLabel: "15.5",
          title: null,
          volume: null,
          language: "en",
          publishedAt: "2025-05-03T00:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52J155",
          duplicateNumber: false,
        },
        {
          id: "01J76XYY77SY7EJ5AJ2S52JSPEC",
          sourceId: "weebcentral",
          mangaId: externalId,
          number: null,
          numberLabel: null,
          title: "Special Extra",
          volume: null,
          language: "en",
          publishedAt: "2025-05-04T00:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52JSPEC",
          duplicateNumber: false,
        },
      ],
      total: 5,
      page: 1,
      limit: 500,
      hasMore: false,
    }),
  };

  const sourcesSvc = new SourcesService(db, cache, cfg, [mockWeebCentralProvider]);
  const res = await sourcesSvc.approve("weebcentral", "01J76XYBD282Y3XKX0KRGD64Q5", "en", "admin-1");
  assert.equal(res.importedChapters, 5);

  const createdChapters = await db.chapter.findMany({ where: { comicId: res.comicId } });
  assert.equal(createdChapters.length, 5);
  assert.deepEqual(
    createdChapters.map((c: any) => c.number),
    [1, 15, 15.001, 15.5, 16],
  );
  assert.equal(createdChapters[4].title, "Special Extra");
});
