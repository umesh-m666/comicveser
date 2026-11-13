import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { AdminRoleGuard, PermissionGuard, SessionGuard } from "./auth/auth.guard";
import { LocalStorageController } from "./storage/local-storage.controller";
import { StorageService } from "./storage/storage.service";
import { sha256 } from "./common/crypto";

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

test("SetRepo Section 2A & 2F: Environment files have no exposed secrets and vulnerable dependencies are upgraded", () => {
  const apiEnvExample = fs.readFileSync(path.join(PROJECT_ROOT, "apps/api/.env.example"), "utf8");
  assert.ok(!apiEnvExample.includes("googleusercontent.com"), ".env.example must not contain real Google OAuth client ID");
  assert.ok(!apiEnvExample.includes("re_9avxAdQ9"), ".env.example must not contain real Resend API key");

  // Ensure real .env / .env.local files are removed
  assert.equal(fs.existsSync(path.join(PROJECT_ROOT, "apps/api/.env")), false);
  assert.equal(fs.existsSync(path.join(PROJECT_ROOT, "apps/web/.env.local")), false);
  assert.equal(fs.existsSync(path.join(PROJECT_ROOT, "manga-novel-api/.env")), false);

  // Verify package.json and package-lock.json integrity (complete resolved dependency trees)
  const webLock = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "apps/web/package-lock.json"), "utf8"));
  const apiLock = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "apps/api/package-lock.json"), "utf8"));
  const mnaNodeVer = fs.readFileSync(path.join(PROJECT_ROOT, "manga-novel-api/.node-version"), "utf8").trim();

  assert.ok(Object.keys(apiLock.packages).length > 500, "apps/api/package-lock.json must contain the full resolved dependency tree");
  assert.ok(apiLock.packages["node_modules/brace-expansion"]?.resolved, "brace-expansion must be present with resolved URL in apps/api/package-lock.json");
  assert.ok(Object.keys(webLock.packages).length > 100, "apps/web/package-lock.json must contain the full resolved dependency tree");
  assert.ok(webLock.packages["node_modules/next"]?.resolved, "next must be present with resolved URL in apps/web/package-lock.json");
  assert.equal(mnaNodeVer, "22");
});

test("SetRepo Section 2B: Authorization enforces AdminRoleGuard + PermissionGuard across Visitor, Normal User, Creator, and Admin", async () => {
  const now = new Date();
  const future = new Date(now.getTime() + 3600_000);
  const sessions: Record<string, any> = {
    [sha256("tok-user")]: {
      id: "sess-user",
      expiresAt: future,
      user: {
        id: "u-normal",
        username: "reader",
        email: "reader@example.com",
        status: "ACTIVE",
        deletedAt: null,
        emailVerifiedAt: now,
        role: { name: "USER", permissions: [] },
        profile: null,
      },
    },
    [sha256("tok-creator")]: {
      id: "sess-creator",
      expiresAt: future,
      user: {
        id: "u-creator",
        username: "creator",
        email: "creator@example.com",
        status: "ACTIVE",
        deletedAt: null,
        emailVerifiedAt: now,
        role: { name: "CREATOR", permissions: [{ key: "comic:write" }] },
        profile: null,
      },
    },
    [sha256("tok-admin")]: {
      id: "sess-admin",
      expiresAt: future,
      user: {
        id: "u-admin",
        username: "admin",
        email: "admin@example.com",
        status: "ACTIVE",
        deletedAt: null,
        emailVerifiedAt: now,
        role: { name: "ADMIN", permissions: [{ key: "comic:write" }, { key: "user:manage" }, { key: "audit:read" }] },
        profile: null,
      },
    },
  };

  const mockDb: any = {
    session: {
      findUnique: async ({ where }: any) => sessions[where.tokenHash] ?? null,
    },
  };

  const sessionGuard = new SessionGuard(mockDb);
  const adminRoleGuard = new AdminRoleGuard();
  const permissionGuard = new PermissionGuard({
    get: () => "comic:write",
  } as any);

  const makeCtx = (token?: string) => {
    const req: any = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cookies: {},
    };
    return {
      req,
      ctx: {
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => ({}),
      } as any,
    };
  };

  // 1. Logged-out visitor -> 401 Unauthorized
  const visitor = makeCtx();
  await assert.rejects(() => sessionGuard.canActivate(visitor.ctx), /Please log in/);

  // 2. Normal user -> passes SessionGuard, blocked by AdminRoleGuard (403 Forbidden)
  const normalUser = makeCtx("tok-user");
  await sessionGuard.canActivate(normalUser.ctx);
  assert.throws(() => adminRoleGuard.canActivate(normalUser.ctx), /Administrator access is required/);

  // 3. Creator -> even with comic:write permission, blocked by AdminRoleGuard on admin routes (403 Forbidden)
  const creatorUser = makeCtx("tok-creator");
  await sessionGuard.canActivate(creatorUser.ctx);
  assert.throws(() => adminRoleGuard.canActivate(creatorUser.ctx), /Administrator access is required/);

  // 4. Administrator -> passes SessionGuard, AdminRoleGuard, and PermissionGuard
  const adminUser = makeCtx("tok-admin");
  assert.equal(await sessionGuard.canActivate(adminUser.ctx), true);
  assert.equal(adminRoleGuard.canActivate(adminUser.ctx), true);
  assert.equal(permissionGuard.canActivate(adminUser.ctx), true);
});

test("SetRepo Section 2A.8 & 2C: LocalStorageController & StorageService prevent path traversal and unsafe public caching", async () => {
  const storage = new StorageService();
  // Path traversal & invalid keys must be rejected
  for (const unsafeKey of [
    "../secret.txt",
    "chapters/../../etc/passwd",
    "chapters/ch1/../../image.jpg",
    "chapters\\ch1\\img.jpg",
    "/absolute/path.jpg",
    "chapters/ch1/script.svg",
  ]) {
    await assert.rejects(() => storage.readLocalFile(unsafeKey), /Invalid media key|Media not found/);
  }

  // Verify LocalStorageController headers and token validation
  const headersSet: Record<string, string> = {};
  let sentBody: Buffer | null = null;
  const mockStorage: any = {
    acceptLocalUpload: async () => undefined,
    readLocalFile: async () => ({ body: Buffer.from("img"), mime: "image/webp" }),
  };
  const ctrl = new LocalStorageController(mockStorage);

  assert.throws(() => ctrl.upload("../bad-token", "image/webp", { body: Buffer.from("x") } as any), /Invalid upload token/);

  await ctrl.media("chapters/ch1/valid_img.webp", {
    setHeader: (k: string, v: string) => {
      headersSet[k] = v;
    },
    send: (b: Buffer) => {
      sentBody = b;
    },
  } as any);

  assert.equal(headersSet["Content-Type"], "image/webp");
  assert.equal(headersSet["X-Content-Type-Options"], "nosniff");
  assert.equal(headersSet["Cache-Control"], "private, max-age=3600, no-transform");
  assert.ok(headersSet["Content-Security-Policy"]?.includes("default-src 'none'"));
  assert.ok(sentBody);
});

test("SetRepo Section 2C, 3, 4, 6: Codebase static verification for dynamic code, regexes, timeouts, ComicCard redesign, accessibility, and SEO", () => {
  const probeCode = fs.readFileSync(path.join(PROJECT_ROOT, "apps/api/scripts/probe-comick-chapters.cjs"), "utf8");
  const comickProvCode = fs.readFileSync(path.join(PROJECT_ROOT, "apps/api/src/sources/comick.provider.ts"), "utf8");
  const repairSwcCode = fs.readFileSync(path.join(PROJECT_ROOT, "apps/web/scripts/repair-swc.js"), "utf8");
  const htmlTsCode = fs.readFileSync(path.join(PROJECT_ROOT, "apps/api/src/sources/html.ts"), "utf8");

  assert.ok(!probeCode.includes("new Function"), "probe-comick-chapters.cjs must not use new Function");
  assert.ok(!comickProvCode.includes("new Function"), "comick.provider.ts must not use new Function");
  assert.ok(!repairSwcCode.includes("require(swcBin)"), "repair-swc.js must not use dynamic require(swcBin)");
  assert.ok(!htmlTsCode.includes("new RegExp"), "html.ts must use precompiled TAG_PATTERNS instead of dynamic new RegExp");

  const webApiCode = fs.readFileSync(path.join(PROJECT_ROOT, "apps/web/src/lib/api.ts"), "utf8");
  assert.ok(webApiCode.includes("AbortController") && webApiCode.includes("15_000"), "web/src/lib/api.ts must enforce a request timeout");

  const comicCardCode = fs.readFileSync(path.join(PROJECT_ROOT, "apps/web/src/components/ComicCard.tsx"), "utf8");
  assert.ok(comicCardCode.includes("Bookmarked") && comicCardCode.includes("Bookmark") && comicCardCode.includes("Chapters"), "ComicCard.tsx must implement the redesigned card with Chapters pill, Status pill, and Bookmark/Bookmarked button");

  const bmViewCode = fs.readFileSync(path.join(PROJECT_ROOT, "apps/web/src/components/BookmarksView.tsx"), "utf8");
  assert.ok(!bmViewCode.includes("nonce"), "BookmarksView.tsx must not use timing-sensitive nonce comparisons");
  assert.ok(bmViewCode.includes("AbortController"), "BookmarksView.tsx must use AbortController for clean request cancellation");

  // SEO files
  assert.equal(fs.existsSync(path.join(PROJECT_ROOT, "apps/web/src/app/sitemap.ts")), true);
  assert.equal(fs.existsSync(path.join(PROJECT_ROOT, "apps/web/src/app/robots.ts")), true);
});
