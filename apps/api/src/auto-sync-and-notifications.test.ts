import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { SourcesService } from "./sources/sources.service";
import { NotificationsService } from "./notifications/notifications.service";
import { SourceError, type ChapterItem, type MangaSourceProvider } from "./sources/provider.interface";
import { resolveChapterDisplayNumber } from "./sources/chapter-display";

function createInMemoryTestRig() {
  const users: any[] = [
    { id: "admin-1", username: "admin", email: "admin@comicverse.app", status: "ACTIVE", deletedAt: null, role: { name: "ADMIN" }, profile: { notifyPrefs: { newChapter: true } } },
    { id: "user-bookmarker", username: "reader1", email: "reader1@example.com", status: "ACTIVE", deletedAt: null, role: { name: "USER" }, profile: { notifyPrefs: { newChapter: true } } },
    { id: "user-muted", username: "reader2", email: "reader2@example.com", status: "ACTIVE", deletedAt: null, role: { name: "USER" }, profile: { notifyPrefs: { newChapter: false } } },
    { id: "user-non-bookmarker", username: "reader3", email: "reader3@example.com", status: "ACTIVE", deletedAt: null, role: { name: "USER" }, profile: { notifyPrefs: { newChapter: true } } },
  ];

  const comics: any[] = [
    {
      id: "comic-wc-1",
      slug: "infinite-mage-weebcentral",
      title: "Infinite Mage",
      altTitle: null,
      publishState: "PUBLISHED",
      deletedAt: null,
      updatedAt: new Date("2026-11-01T00:00:00Z"),
    },
    {
      id: "comic-asura-1",
      slug: "sword-hound-asurascans",
      title: "Return of the Iron-Blooded Sword Hound",
      altTitle: null,
      publishState: "PUBLISHED",
      deletedAt: null,
      updatedAt: new Date("2026-11-01T00:00:00Z"),
    },
  ];

  const sourceTitles: any[] = [
    {
      id: "st-wc-1",
      sourceId: "weebcentral",
      externalId: "01J76XY7E5E1C5Y9J0M2FCVQ8H",
      title: "Infinite Mage",
      sourceUrl: "https://weebcentral.com/series/01J76XY7E5E1C5Y9J0M2FCVQ8H/Infinite-Mage",
      coverUrl: null,
      contentType: "manhwa",
      state: "APPROVED",
      role: "PRIMARY",
      comicId: "comic-wc-1",
      updatedAt: new Date("2026-11-01T00:00:00Z"),
    },
    {
      id: "st-asura-1",
      sourceId: "asurascans",
      externalId: "return-of-the-iron-blooded-sword-hound",
      title: "Return of the Iron-Blooded Sword Hound",
      sourceUrl: "https://asurascans.com/comics/return-of-the-iron-blooded-sword-hound",
      coverUrl: null,
      contentType: "manhwa",
      state: "APPROVED",
      role: "PRIMARY",
      comicId: "comic-asura-1",
      updatedAt: new Date("2026-11-01T00:00:00Z"),
    },
  ];

  // Existing published chapters on comic-wc-1 where Episode 10 and Episode 10.5 were previously mis-stored as Special
  const chapters: any[] = [
    {
      id: "ch-wc-ep10",
      comicId: "comic-wc-1",
      number: 1, // wrong sequential number assigned previously when numberLabel was null
      title: "Special chapter",
      publishState: "PUBLISHED",
      publishedAt: new Date("2026-10-01T00:00:00Z"),
      deletedAt: null,
      images: [{ id: "img-preserved-1", position: 0, storageKey: "chapters/ch-wc-ep10/p1.webp" }],
    },
    {
      id: "ch-wc-ep10-5",
      comicId: "comic-wc-1",
      number: 2, // wrong sequential number assigned previously
      title: "Episode 10.5",
      publishState: "PUBLISHED",
      publishedAt: new Date("2026-10-02T00:00:00Z"),
      deletedAt: null,
      images: [],
    },
    {
      id: "ch-wc-manual-99",
      comicId: "comic-wc-1",
      number: 99,
      title: "Manual Chapter 99",
      publishState: "PUBLISHED",
      publishedAt: new Date("2026-10-05T00:00:00Z"),
      deletedAt: null,
      images: [{ id: "img-manual-99", position: 0, storageKey: "chapters/ch-wc-manual-99/p1.webp" }],
    },
  ];

  const sourceChapters: any[] = [
    {
      id: "sc-wc-ep10",
      sourceTitleId: "st-wc-1",
      chapterId: "ch-wc-ep10",
      externalId: "01J76XYY77SY7EJ5AJ2S52EP10",
      numberLabel: null, // previously lost
      originalLabel: null,
      title: "Episode 10",
      volume: null,
      sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52EP10",
      language: "en",
      publishedAt: null,
      pageCount: 25,
      groups: [],
    },
    {
      id: "sc-wc-ep10-5",
      sourceTitleId: "st-wc-1",
      chapterId: "ch-wc-ep10-5",
      externalId: "01J76XYY77SY7EJ5AJ2S52E105",
      numberLabel: null,
      originalLabel: null,
      title: "Episode 10.5",
      volume: null,
      sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52E105",
      language: "en",
      publishedAt: null,
      pageCount: 20,
      groups: [],
    },
  ];

  const bookmarks: any[] = [
    { id: "bm-1", userId: "user-bookmarker", comicId: "comic-wc-1" },
    { id: "bm-2", userId: "user-muted", comicId: "comic-wc-1" },
    { id: "bm-3", userId: "user-bookmarker", comicId: "comic-asura-1" },
  ];

  const readingHistory: any[] = [
    { id: "rh-1", userId: "user-bookmarker", comicId: "comic-wc-1", chapterId: "ch-wc-ep10", imageIndex: 5, scrollY: 400 },
  ];

  const notifications: any[] = [];
  const auditLogs: any[] = [];
  let lockHeld = false;

  const db: any = {
    tryAcquireSyncLock: async () => {
      if (lockHeld) return false;
      lockHeld = true;
      return true;
    },
    releaseSyncLock: async () => {
      lockHeld = false;
    },
    sourceSetting: {
      findMany: async () => [],
      findUnique: async () => null,
    },
    user: {
      findUnique: async ({ where }: any) => users.find((u) => u.id === where.id) ?? null,
      findMany: async ({ where }: any) =>
        users.filter((u) => {
          if (where?.role?.name && u.role.name !== where.role.name) return false;
          if (where?.status && u.status !== where.status) return false;
          return true;
        }),
    },
    userProfile: {
      findUnique: async ({ where }: any) => {
        const u = users.find((x) => x.id === where.userId);
        return u ? u.profile : null;
      },
      upsert: async ({ where, update, create }: any) => {
        const u = users.find((x) => x.id === where.userId);
        if (u) u.profile = { ...u.profile, ...(update ?? create) };
        return u?.profile;
      },
    },
    comic: {
      findFirst: async ({ where }: any) => comics.find((c) => c.id === where.id && c.deletedAt === null) ?? null,
      update: async ({ where, data }: any) => {
        const c = comics.find((x) => x.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
    },
    sourceTitle: {
      findMany: async ({ where }: any) =>
        sourceTitles
          .filter((st) => {
            if (where?.comicId && st.comicId !== where.comicId) return false;
            if (where?.state && st.state !== where.state) return false;
            return true;
          })
          .map((st) => ({
            ...st,
            comic: comics.find((c) => c.id === st.comicId) ?? null,
          })),
      update: async ({ where, data }: any) => {
        const st = sourceTitles.find((x) => x.id === where.id);
        if (st) Object.assign(st, data);
        return st;
      },
    },
    chapter: {
      findMany: async ({ where }: any) =>
        chapters
          .filter((c) => (!where?.comicId || c.comicId === where.comicId) && c.deletedAt === null)
          .map((c) => {
            const sc = sourceChapters.find((s) => s.chapterId === c.id) ?? null;
            const st = sc ? sourceTitles.find((t) => t.id === sc.sourceTitleId) ?? null : null;
            return {
              ...c,
              sourceChapter: sc ? { ...sc, sourceTitle: st } : null,
              _count: { images: c.images?.length ?? 0 },
            };
          }),
      findUnique: async ({ where }: any) => {
        const c = chapters.find((x) => x.id === where.id);
        if (!c) return null;
        const comic = comics.find((cm) => cm.id === c.comicId);
        const sc = sourceChapters.find((s) => s.chapterId === c.id) ?? null;
        const st = sc ? sourceTitles.find((t) => t.id === sc.sourceTitleId) ?? null : null;
        return {
          ...c,
          comic,
          sourceChapter: sc ? { ...sc, sourceTitle: st } : null,
        };
      },
      update: async ({ where, data }: any) => {
        const c = chapters.find((x) => x.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
      create: async ({ data }: any) => {
        const newCh = {
          id: `ch-auto-${chapters.length + 1}`,
          comicId: data.comicId,
          number: data.number,
          title: data.title,
          publishState: data.publishState,
          publishedAt: data.publishedAt,
          deletedAt: null,
          images: [],
        };
        chapters.push(newCh);
        let createdSc = null;
        if (data.sourceChapter?.create) {
          const scData = data.sourceChapter.create;
          createdSc = {
            id: `sc-auto-${sourceChapters.length + 1}`,
            chapterId: newCh.id,
            ...scData,
          };
          sourceChapters.push(createdSc);
        }
        return { ...newCh, sourceChapter: createdSc };
      },
    },
    sourceChapter: {
      findMany: async ({ where }: any) =>
        sourceChapters.filter((sc) => !where?.sourceTitleId || sc.sourceTitleId === where.sourceTitleId),
      findUnique: async ({ where }: any) => {
        const key = where?.sourceTitleId_externalId;
        if (!key) return null;
        return (
          sourceChapters.find(
            (sc) => sc.sourceTitleId === key.sourceTitleId && sc.externalId === key.externalId,
          ) ?? null
        );
      },
      update: async ({ where, data }: any) => {
        const sc = sourceChapters.find((x) => x.id === where.id);
        if (sc) Object.assign(sc, data);
        return sc;
      },
    },
    bookmark: {
      findMany: async ({ where, cursor, skip }: any) => {
        if (cursor && skip) return [];
        return bookmarks
          .filter((b) => b.comicId === where.comicId)
          .map((b) => ({
            ...b,
            user: users.find((u) => u.id === b.userId),
          }));
      },
    },
    notification: {
      create: async ({ data }: any) => {
        const n = {
          id: `notif-${notifications.length + 1}`,
          readAt: null,
          createdAt: new Date(),
          ...data,
        };
        notifications.push(n);
        return n;
      },
      createMany: async ({ data }: any) => {
        for (const row of data) {
          notifications.push({
            id: `notif-${notifications.length + 1}`,
            readAt: null,
            createdAt: new Date(),
            ...row,
          });
        }
        return { count: data.length };
      },
      findFirst: async ({ where }: any) =>
        notifications.find(
          (n) =>
            (!where.userId || n.userId === where.userId) &&
            (!where.type || n.type === where.type) &&
            (!where.href || n.href === where.href),
        ) ?? null,
      findMany: async ({ where }: any) =>
        notifications
          .filter((n) => {
            if (where?.userId && typeof where.userId === "string" && n.userId !== where.userId) return false;
            if (where?.userId?.in && !where.userId.in.includes(n.userId)) return false;
            if (where?.readAt === null && n.readAt !== null) return false;
            if (where?.type && typeof where.type === "string" && n.type !== where.type) return false;
            if (where?.type?.in && !where.type.in.includes(n.type)) return false;
            if (where?.href && n.href !== where.href) return false;
            return true;
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const n of notifications) {
          if (n.userId !== where.userId) continue;
          if (where.readAt === null && n.readAt !== null) continue;
          if (where.id?.in && !where.id.in.includes(n.id)) continue;
          Object.assign(n, data);
          count++;
        }
        return { count };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      },
    },
    $transaction: async (fn: any) => fn(db),
  };

  return {
    db,
    users,
    comics,
    sourceTitles,
    chapters,
    sourceChapters,
    bookmarks,
    readingHistory,
    notifications,
    auditLogs,
    setLockHeld: (v: boolean) => {
      lockHeld = v;
    },
  };
}

test("PART 2, 4, 5, 6, 8: Existing published comic chapter repair, automatic new chapter sync, admin-only alerts, and bookmark notifications", async () => {
  const rig = createInMemoryTestRig();
  const cache: any = {
    wrap: async (_k: string, _ttl: number, fn: () => Promise<any>) => fn(),
    delete: async () => undefined,
  };

  let failCh12Pages = true;

  const weebProvider: MangaSourceProvider = {
    id: "weebcentral",
    displayName: "WeebCentral",
    info: () => ({
      id: "weebcentral",
      displayName: "WeebCentral",
      officialUrl: "https://weebcentral.com",
      attribution: "WeebCentral",
      capabilities: { search: true, details: true, chapters: true, pages: true, types: ["manhwa"], languages: ["en"] },
      notes: [],
    }),
    health: async () => ({ ok: true, latencyMs: 10 }),
    search: async () => ({ items: [], total: 0, page: 1, limit: 20, hasMore: false }),
    details: async () => ({} as any),
    chapters: async () => {
      const items: ChapterItem[] = [
        {
          id: "01J76XYY77SY7EJ5AJ2S52EP10",
          sourceId: "weebcentral",
          mangaId: "01J76XY7E5E1C5Y9J0M2FCVQ8H",
          number: 10,
          numberLabel: "10",
          originalLabel: "Episode 10",
          title: "The Magic Academy",
          volume: null,
          language: "en",
          publishedAt: "2026-11-01T10:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52EP10",
          duplicateNumber: false,
        },
        {
          id: "01J76XYY77SY7EJ5AJ2S52E105",
          sourceId: "weebcentral",
          mangaId: "01J76XY7E5E1C5Y9J0M2FCVQ8H",
          number: 10.5,
          numberLabel: "10.5",
          originalLabel: "Episode 10.5",
          title: null,
          volume: null,
          language: "en",
          publishedAt: "2026-11-02T10:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52E105",
          duplicateNumber: false,
        },
        // Brand-new Episode 11
        {
          id: "01J76XYY77SY7EJ5AJ2S52EP11",
          sourceId: "weebcentral",
          mangaId: "01J76XY7E5E1C5Y9J0M2FCVQ8H",
          number: 11,
          numberLabel: "11",
          originalLabel: "Episode 11",
          title: "Breakthrough",
          volume: null,
          language: "en",
          publishedAt: "2026-11-10T12:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52EP11",
          duplicateNumber: false,
        },
        // Brand-new Episode 12 (initially fails page retrieval, then succeeds on retry)
        {
          id: "01J76XYY77SY7EJ5AJ2S52EP12",
          sourceId: "weebcentral",
          mangaId: "01J76XY7E5E1C5Y9J0M2FCVQ8H",
          number: 12,
          numberLabel: "12",
          originalLabel: "Episode 12",
          title: "Archmage Trial",
          volume: null,
          language: "en",
          publishedAt: "2026-11-10T14:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52EP12",
          duplicateNumber: false,
        },
        // Conflicting Episode 99 (matches manual chapter 99 -> must NOT overwrite manual chapter)
        {
          id: "01J76XYY77SY7EJ5AJ2S52EP99",
          sourceId: "weebcentral",
          mangaId: "01J76XY7E5E1C5Y9J0M2FCVQ8H",
          number: 99,
          numberLabel: "99",
          originalLabel: "Episode 99",
          title: "Provider 99",
          volume: null,
          language: "en",
          publishedAt: "2026-11-10T15:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://weebcentral.com/chapters/01J76XYY77SY7EJ5AJ2S52EP99",
          duplicateNumber: false,
        },
      ];
      return { items, total: items.length, page: 1, limit: 500, hasMore: false };
    },
    pages: async (chapterId: string) => {
      if (chapterId === "01J76XYY77SY7EJ5AJ2S52EP12" && failCh12Pages) {
        throw new SourceError("SOURCE_UNAVAILABLE", "WeebCentral image server timeout");
      }
      return {
        sourceId: "weebcentral",
        mangaId: "01J76XY7E5E1C5Y9J0M2FCVQ8H",
        chapterId,
        chapterTitle: "Episode",
        chapterNumber: "11",
        language: "en",
        pages: [
          { pageNumber: 1, imageUrl: "https://official.lowee.us/1.webp", width: 800, height: 1200 },
          { pageNumber: 2, imageUrl: "https://official.lowee.us/2.webp", width: 800, height: 1200 },
        ],
        groups: [],
        sourceUrl: `https://weebcentral.com/chapters/${chapterId}`,
      };
    },
  };

  const asuraProvider: MangaSourceProvider = {
    id: "asurascans",
    displayName: "AsuraScans",
    info: () => ({
      id: "asurascans",
      displayName: "AsuraScans",
      officialUrl: "https://asurascans.com",
      attribution: "AsuraScans",
      capabilities: { search: true, details: true, chapters: true, pages: true, types: ["manhwa"], languages: ["en"] },
      notes: [],
    }),
    health: async () => ({ ok: true, latencyMs: 10 }),
    search: async () => ({ items: [], total: 0, page: 1, limit: 20, hasMore: false }),
    details: async () => ({} as any),
    chapters: async () => ({
      items: [
        {
          id: "188",
          sourceId: "asurascans",
          mangaId: "return-of-the-iron-blooded-sword-hound",
          number: 188,
          numberLabel: "188",
          originalLabel: "Chapter 188",
          title: null,
          volume: null,
          language: "en",
          publishedAt: "2026-11-10T00:00:00.000Z",
          groups: [],
          pageCount: null,
          sourceUrl: "https://asurascans.com/comics/return-of-the-iron-blooded-sword-hound/chapter/188",
          duplicateNumber: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 500,
      hasMore: false,
    }),
    pages: async (chapterId: string) => ({
      sourceId: "asurascans",
      mangaId: "return-of-the-iron-blooded-sword-hound",
      chapterId,
      chapterTitle: "Chapter 188",
      chapterNumber: "188",
      language: "en",
      pages: [{ pageNumber: 1, imageUrl: "https://cdn.asurascans.com/asura-images/chapters/1.webp", width: 800, height: 1200 }],
      groups: [],
      sourceUrl: "https://asurascans.com/comics/return-of-the-iron-blooded-sword-hound/chapter/188",
    }),
  };

  const notifService = new NotificationsService(rig.db);
  const sourcesService = new SourcesService(
    rig.db,
    cache,
    { enabled: true, timeoutMs: 10_000, userAgent: "ComicVerse/1.0" },
    [weebProvider, asuraProvider],
    notifService,
  );

  // 1. Run automatic chapter synchronization (Pass 1)
  const sync1 = await sourcesService.runAutomaticChapterSync();
  assert.equal(sync1.skipped, false);
  assert.equal(sync1.checkedComics, 2);

  // Verify Part 2: Existing published chapters on comic-wc-1 were repaired from Special/1,2 to 10 and 10.5
  const repairedEp10 = rig.chapters.find((c) => c.id === "ch-wc-ep10")!;
  const repairedSc10 = rig.sourceChapters.find((s) => s.chapterId === "ch-wc-ep10")!;
  assert.equal(repairedEp10.number, 10);
  assert.equal(repairedEp10.title, "Chapter 10: The Magic Academy");
  assert.equal(repairedSc10.numberLabel, "10");
  assert.equal(repairedSc10.originalLabel, "Episode 10");
  assert.equal(repairedSc10.publishedAt?.toISOString(), "2026-11-01T10:00:00.000Z");
  assert.equal(resolveChapterDisplayNumber(repairedEp10, repairedSc10), "10");
  // Existing chapter images, bookmarks, and reading history were preserved
  assert.equal(repairedEp10.images.length, 1);
  assert.equal(rig.readingHistory[0].chapterId, "ch-wc-ep10");

  const repairedEp105 = rig.chapters.find((c) => c.id === "ch-wc-ep10-5")!;
  assert.equal(repairedEp105.number, 10.5);

  // Manual Chapter 99 was preserved and NOT overwritten
  const manualCh99 = rig.chapters.find((c) => c.id === "ch-wc-manual-99")!;
  assert.equal(manualCh99.title, "Manual Chapter 99");
  assert.equal(manualCh99.images.length, 1);

  // Verify Part 4: Episode 11 (WeebCentral) and Chapter 188 (AsuraScans) were automatically published,
  // while Episode 12 (whose page retrieval failed) was NOT published and was recorded in failedChapterImports
  assert.equal(sync1.publishedChapters, 2);
  assert.equal(sync1.failedChapters, 1);
  assert.equal(sourcesService.getFailedChapterImports().length, 1);
  assert.equal(sourcesService.getFailedChapterImports()[0].chapterExternalId, "01J76XYY77SY7EJ5AJ2S52EP12");

  // Verify Part 5: Admin received publication alerts for Episode 11 and Chapter 188, and a failure alert for Episode 12
  const adminAll = await notifService.list("admin-1", 1, "all", "ADMIN");
  assert.equal(adminAll.items.length, 3);
  assert.ok(adminAll.items.some((n: any) => n.body.includes("Episode 11 → Chapter 11") && n.body.includes("Successfully Published")));
  assert.ok(adminAll.items.some((n: any) => n.body.includes("AsuraScans") && n.body.includes("Chapter 188")));
  assert.ok(adminAll.items.some((n: any) => n.title.includes("failed") && n.body.includes("Episode 12")));

  // Verify Part 8: Admin operational notification filters (All, Published, Failed, WeebCentral, AsuraScans)
  const adminPublished = await notifService.listAdminOperationalNotifications("admin-1", { filter: "published" });
  const adminFailed = await notifService.listAdminOperationalNotifications("admin-1", { filter: "failed" });
  const adminWeeb = await notifService.listAdminOperationalNotifications("admin-1", { filter: "weebcentral" });
  const adminAsura = await notifService.listAdminOperationalNotifications("admin-1", { filter: "asurascans" });
  assert.equal(adminPublished.total, 2);
  assert.equal(adminFailed.total, 1);
  assert.equal(adminWeeb.total, 2);
  assert.equal(adminAsura.total, 1);

  // Verify Part 5 & Part 6: Normal users NEVER receive or see admin alerts;
  // Bookmark owner with notifications enabled received 2 new chapter alerts (Episode 11 and Chapter 188);
  // Muted bookmark owner and non-bookmarker received 0 alerts
  const bookmarkerAll = await notifService.list("user-bookmarker", 1, "all", "USER");
  const bookmarkerChapters = await notifService.list("user-bookmarker", 1, "chapters", "USER");
  const bookmarkerMessages = await notifService.list("user-bookmarker", 1, "messages", "USER");
  assert.equal(bookmarkerAll.unread, 2);
  assert.equal(bookmarkerAll.items.length, 2);
  assert.equal(bookmarkerChapters.items.length, 2);
  assert.equal(bookmarkerMessages.items.length, 0);
  assert.ok(bookmarkerAll.items.every((n: any) => !n.meta?.adminOnly));
  assert.ok(bookmarkerAll.items.some((n: any) => n.title.includes("New Chapter Released!") && n.body.includes("188") && n.body.includes("AsuraScans")));

  const mutedList = await notifService.list("user-muted", 1, "all", "USER");
  const nonBookmarkerList = await notifService.list("user-non-bookmarker", 1, "all", "USER");
  assert.equal(mutedList.items.length, 0);
  assert.equal(nonBookmarkerList.items.length, 0);

  // Verify Retry & Idempotency (Pass 2): Episode 12 now succeeds, while Episode 11 and Chapter 188 are NOT duplicated
  failCh12Pages = false;
  const sync2 = await sourcesService.runAutomaticChapterSync();
  assert.equal(sync2.publishedChapters, 1); // Only Episode 12 is newly published
  assert.equal(sourcesService.getFailedChapterImports().length, 0); // Cleared after successful retry

  const bookmarkerAfterRetry = await notifService.list("user-bookmarker", 1, "chapters", "USER");
  assert.equal(bookmarkerAfterRetry.items.length, 3); // 11, 188, and 12 — zero duplicates!

  // Verify Mark Read / Mark All Read
  await notifService.markRead("user-bookmarker", [bookmarkerAfterRetry.items[0].id]);
  const afterSingleRead = await notifService.list("user-bookmarker", 1, "all", "USER");
  assert.equal(afterSingleRead.unread, 2);

  await notifService.markRead("user-bookmarker");
  const afterAllRead = await notifService.list("user-bookmarker", 1, "all", "USER");
  assert.equal(afterAllRead.unread, 0);

  // Verify Distributed Lock prevents concurrent worker execution
  rig.setLockHeld(true);
  const lockedRun = await sourcesService.runAutomaticChapterSync();
  assert.equal(lockedRun.skipped, true);
  assert.equal(lockedRun.reason, "lock_held");
});

test("PART 7, 9, 10, 11: Verifies UI NotificationPopup, Unified Color Palette, Navigation, and Removal of Novels & Premium", () => {
  const webSrc = path.resolve(__dirname, "../../web/src");

  const bellCode = fs.readFileSync(path.join(webSrc, "components/NotificationBell.tsx"), "utf8");
  assert.ok(bellCode.includes("#100E16"), "NotificationBell must use #100E16 dark background");
  assert.ok(bellCode.includes("#211B2D"), "NotificationBell must use #211B2D card background");
  assert.ok(bellCode.includes("#9333EA"), "NotificationBell must use #9333EA primary purple");
  assert.ok(bellCode.includes("#A855F7"), "NotificationBell must use #A855F7 secondary purple");
  assert.ok(bellCode.includes("#A8A1B5"), "NotificationBell must use #A8A1B5 muted text");
  assert.ok(bellCode.includes('"All"') && bellCode.includes('"Chapters"') && bellCode.includes('"Messages"'), "NotificationBell must have All, Chapters, and Messages tabs");
  assert.ok(bellCode.includes("View All Notifications"), "NotificationBell must include View All Notifications button");

  const navCode = fs.readFileSync(path.join(webSrc, "lib/nav.ts"), "utf8");
  assert.ok(!navCode.includes("/novels"), "lib/nav.ts must not contain /novels");
  assert.ok(navCode.includes("Home") && navCode.includes("Manga") && navCode.includes("Browse") && navCode.includes("Bookmarks") && !navCode.includes("Resources"));

  const headerCode = fs.readFileSync(path.join(webSrc, "components/Nav.tsx"), "utf8");
  assert.ok(!headerCode.includes("UpgradeLink"), "Nav.tsx must not render UpgradeLink");

  const accountDashCode = fs.readFileSync(path.join(webSrc, "components/AccountDashboard.tsx"), "utf8");
  assert.ok(!accountDashCode.includes('href="/premium"'), "AccountDashboard.tsx must not link to /premium");

  const premiumPageCode = fs.readFileSync(path.join(webSrc, "app/premium/page.tsx"), "utf8");
  assert.ok(premiumPageCode.includes('redirect("/browse")'), "/premium route must cleanly redirect to /browse");
});

test("Homepage 5-section redesign, multi-cover FeaturedCarousel, 2-column LatestUpdates, Ranked PopularTabs, and 4-tab Navigation", () => {
  const webSrc = path.resolve(__dirname, "../../web/src");
  const pageCode = fs.readFileSync(path.join(webSrc, "app/page.tsx"), "utf8");

  const idxFeatured = pageCode.indexOf("<FeaturedCarousel");
  const idxLatest = pageCode.indexOf('title="Latest Chapter Updates"');
  const idxTrending = pageCode.indexOf('title="Trending Comics"');
  const idxPopular = pageCode.indexOf('title="Popular Comics"');
  const idxAdded = pageCode.indexOf('title="Recently Added"');

  assert.ok(idxFeatured > -1 && idxLatest > idxFeatured, "Latest Chapter Updates must follow FeaturedCarousel");
  assert.ok(idxTrending > idxLatest, "Trending Comics must follow Latest Chapter Updates");
  assert.ok(idxPopular > idxTrending, "Popular Comics must follow Trending Comics");
  assert.ok(idxAdded > idxPopular, "Recently Added must follow Popular Comics");

  const featuredCode = fs.readFileSync(path.join(webSrc, "components/FeaturedCarousel.tsx"), "utf8");
  assert.ok(featuredCode.includes("Select featured comic") && featuredCode.includes("scale-100") && featuredCode.includes("scale-95"), "FeaturedCarousel must render horizontal covers with larger selected cover");

  const latestCode = fs.readFileSync(path.join(webSrc, "components/LatestUpdates.tsx"), "utf8");
  assert.ok(latestCode.includes("grid-cols-1") && latestCode.includes("md:grid-cols-2"), "LatestUpdates must use 1 column on mobile and 2 columns on desktop");

  const popularCode = fs.readFileSync(path.join(webSrc, "components/PopularTabs.tsx"), "utf8");
  assert.ok(popularCode.includes("Weekly") && popularCode.includes("Monthly") && popularCode.includes("All Time"), "PopularTabs must provide Weekly, Monthly, and All Time filters");

  const bottomNavCode = fs.readFileSync(path.join(webSrc, "components/BottomNav.tsx"), "utf8");
  assert.ok(bottomNavCode.includes("grid-cols-4"), "BottomNav must use 4 columns for Home, Manga, Browse, and Bookmarks");
});
