import { Body, Controller, Get, Global, HttpCode, Injectable, Logger, Module, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationType } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { Authenticated, AuthUser, CurrentUser } from "../auth/auth.guard";
import { resolveChapterDisplayNumber, resolveChapterPublishedAt } from "../sources/chapter-display";

class ReadDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids?: string[];
}

class SettingsDto {
  @IsBoolean()
  newChapter: boolean;
}

class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /**
   * chapters / alerts = new chapters, bookmark updates, and (for admins) chapter publication alerts.
   * messages = platform messages, account notices, creator announcements, review replies, and issue responses.
   * Omitted / all = everything the current user is authorized to see.
   */
  @IsOptional()
  @IsIn(["all", "messages", "alerts", "chapters"])
  group?: "all" | "messages" | "alerts" | "chapters";
}

const GROUPS = {
  messages: ["PLATFORM", "ACCOUNT", "CREATOR_ANNOUNCEMENT", "REVIEW_REPLY"] as const,
  alerts: ["NEW_CHAPTER", "BOOKMARK_UPDATE"] as const,
  chapters: ["NEW_CHAPTER", "BOOKMARK_UPDATE"] as const,
};

export interface AdminChapterAlertPayload {
  comicId: string;
  comicTitle: string;
  comicSlug: string;
  providerId: string;
  providerName: string;
  chapterId?: string | null;
  externalChapterId?: string | null;
  chapterNumber: number | null;
  displayNumber: string;
  originalLabel?: string | null;
  chapterTitle?: string | null;
  sourceReleaseDate?: Date | string | null;
  publishedAt?: Date | string | null;
  status: "PUBLISHED" | "FAILED";
  chapterUrl?: string | null;
  sourceUrl?: string | null;
  errorMessage?: string | null;
}

function formatReadableDate(val?: Date | string | null, includeTime = false): string {
  if (!val) return "Unknown";
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime()) || d.getTime() <= 0) return "Unknown";
  if (includeTime) {
    return d.toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

@Injectable()
export class NotificationsService {
  private log = new Logger("Notifications");
  constructor(private db: PrismaService) {}

  async push(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    href?: string,
    meta?: Record<string, unknown>,
  ) {
    try {
      return await (this.db.notification as any).create({
        data: {
          userId,
          type,
          title: title.slice(0, 200),
          body: body.slice(0, 1000),
          href: href ?? null,
          ...(meta ? { meta } : {}),
        },
      });
    } catch {
      return await this.db.notification.create({
        data: {
          userId,
          type,
          title: title.slice(0, 200),
          body: body.slice(0, 1000),
          href: href ?? null,
        },
      });
    }
  }

  private isAdminNotification(item: any): boolean {
    if (item?.meta && typeof item.meta === "object" && (item.meta as any).adminOnly === true) {
      return true;
    }
    if (typeof item?.title === "string" && (
      item.title.startsWith("New chapter automatically published") ||
      item.title.startsWith("[Admin Alert]") ||
      item.title.startsWith("Chapter synchronization failed")
    )) {
      return true;
    }
    return false;
  }

  private isAdminChapterCategory(item: any): boolean {
    if (item?.meta && typeof item.meta === "object") {
      const ev = (item.meta as any).event;
      if (ev === "AUTO_CHAPTER_PUBLISHED" || ev === "AUTO_CHAPTER_FAILED" || ev === "MANUAL_CHAPTER_PUBLISHED") {
        return true;
      }
    }
    if (typeof item?.title === "string" && item.title.startsWith("New chapter automatically published")) {
      return true;
    }
    return false;
  }

  async list(userId: string, page: number, group?: "all" | "messages" | "alerts" | "chapters", userRole?: string) {
    let isAdmin = userRole === "ADMIN";
    if (!userRole) {
      try {
        const u = await this.db.user.findUnique({ where: { id: userId }, select: { role: { select: { name: true } } } });
        isAdmin = u?.role?.name === "ADMIN";
      } catch {
        isAdmin = false;
      }
    }

    const effectiveGroup = group === "all" ? undefined : group;
    const isChaptersTab = effectiveGroup === "alerts" || effectiveGroup === "chapters";
    const isMessagesTab = effectiveGroup === "messages";

    // Fetch user notifications; if admin and filtering by chapters/messages, include PLATFORM alerts that carry chapter sync metadata
    const typeFilter = isChaptersTab
      ? { type: { in: isAdmin ? (["NEW_CHAPTER", "BOOKMARK_UPDATE", "PLATFORM"] as NotificationType[]) : ([...GROUPS.chapters] as NotificationType[]) } }
      : isMessagesTab
      ? { type: { in: [...GROUPS.messages] as NotificationType[] } }
      : {};

    const [rawItems, allUnreadRaw, profile] = await Promise.all([
      this.db.notification.findMany({
        where: { userId, ...typeFilter },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.db.notification.findMany({
        where: { userId, readAt: null },
        select: { id: true, type: true, title: true, meta: true } as any,
      }).catch(() =>
        this.db.notification.findMany({
          where: { userId, readAt: null },
          select: { id: true, type: true, title: true },
        }),
      ),
      this.db.userProfile.findUnique({ where: { userId }, select: { notifyPrefs: true } }),
    ]);

    // Enforce strict authorization: non-admin users must NEVER see admin-only notifications
    const authorizedItems = (rawItems ?? []).filter((item: any) => {
      if (!isAdmin && this.isAdminNotification(item)) return false;
      if (isChaptersTab) {
        return item.type === "NEW_CHAPTER" || item.type === "BOOKMARK_UPDATE" || (isAdmin && this.isAdminChapterCategory(item));
      }
      if (isMessagesTab) {
        if (isAdmin && this.isAdminChapterCategory(item) && item.meta?.status === "PUBLISHED") {
          return false;
        }
        return GROUPS.messages.includes(item.type);
      }
      return true;
    });

    const authorizedUnread = (allUnreadRaw ?? []).filter((item: any) => isAdmin || !this.isAdminNotification(item)).length;
    const start = (Math.max(1, page) - 1) * 20;
    const pagedItems = authorizedItems.slice(start, start + 20);

    return {
      unread: authorizedUnread,
      items: pagedItems,
      prefs: { newChapter: (profile?.notifyPrefs as any)?.newChapter !== false },
    };
  }

  async markRead(userId: string, ids?: string[]) {
    await this.db.notification.updateMany({
      where: { userId, readAt: null, ...(ids?.length && { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
  }

  async setPrefs(userId: string, newChapter: boolean) {
    await this.db.userProfile.upsert({
      where: { userId },
      update: { notifyPrefs: { newChapter } },
      create: { userId, notifyPrefs: { newChapter } },
    });
  }

  /**
   * Fans out new chapter notifications to users who bookmarked the comic and have newChapter notifications enabled.
   * Prevents duplicate notifications for the same (userId, chapterId).
   */
  async notifyNewChapter(
    comicId: string,
    chapterId: string,
    opts?: {
      providerId?: string | null;
      providerName?: string | null;
      sourceReleaseDate?: Date | string | null;
      displayNumber?: string | null;
      originalLabel?: string | null;
    },
  ) {
    const ch = await this.db.chapter.findUnique({
      where: { id: chapterId },
      select: {
        number: true,
        title: true,
        publishedAt: true,
        comic: { select: { title: true, slug: true } },
        sourceChapter: {
          select: {
            numberLabel: true,
            originalLabel: true,
            title: true,
            publishedAt: true,
            sourceTitle: { select: { sourceId: true } },
          },
        },
      },
    }).catch(() =>
      this.db.chapter.findUnique({
        where: { id: chapterId },
        select: {
          number: true,
          title: true,
          publishedAt: true,
          comic: { select: { title: true, slug: true } },
        },
      }),
    );
    if (!ch) return { notifiedCount: 0 };

    const sc = (ch as any).sourceChapter;
    const displayNum = opts?.displayNumber ?? resolveChapterDisplayNumber(ch, sc);
    const providerId = opts?.providerId ?? sc?.sourceTitle?.sourceId ?? null;
    const providerName =
      opts?.providerName ??
      (providerId === "weebcentral" ? "WeebCentral" : providerId === "asurascans" ? "AsuraScans" : providerId);
    const releaseDate = opts?.sourceReleaseDate ?? resolveChapterPublishedAt(ch, sc);
    const releaseDateLabel = releaseDate ? formatReadableDate(releaseDate, false) : null;

    const href = `/comics/${ch.comic.slug}/chapter/${chapterId}`;
    const title = `New Chapter Released! — ${ch.comic.title}`;
    const bodyParts = [
      `Comic: ${ch.comic.title}`,
      `Chapter: ${displayNum}`,
      ...(providerName ? [`Provider: ${providerName}`] : []),
      ...(releaseDateLabel && releaseDateLabel !== "Unknown" ? [`Release date: ${releaseDateLabel}`] : []),
    ];
    const body = bodyParts.join(" · ");
    const meta = {
      event: "BOOKMARK_NEW_CHAPTER",
      comicId,
      comicTitle: ch.comic.title,
      comicSlug: ch.comic.slug,
      chapterId,
      chapterNumber: ch.number,
      displayNumber: displayNum,
      providerId,
      providerName,
      releaseDate: releaseDate ? new Date(releaseDate).toISOString() : null,
      adminOnly: false,
    };

    let notifiedCount = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.db.bookmark.findMany({
        where: { comicId },
        orderBy: { id: "asc" },
        take: 500,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        select: {
          id: true,
          userId: true,
          user: { select: { profile: { select: { notifyPrefs: true } } } },
        },
      });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;

      const enabledTargets = rows.filter((r: any) => (r.user?.profile?.notifyPrefs as any)?.newChapter !== false);
      if (!enabledTargets.length) continue;

      // Prevent duplicate notifications for the same chapter href
      const existingForChapter = await this.db.notification.findMany({
        where: {
          userId: { in: enabledTargets.map((t: { userId: string }) => t.userId) },
          type: "NEW_CHAPTER",
          href,
        },
        select: { userId: true },
      }).catch(() => [] as { userId: string }[]);
      const alreadyNotifiedIds = new Set(existingForChapter.map((e: { userId: string }) => e.userId));
      const targets = enabledTargets.filter((t: { userId: string }) => !alreadyNotifiedIds.has(t.userId));
      if (!targets.length) continue;

      try {
        await (this.db.notification as any).createMany({
          data: targets.map((r: { userId: string }) => ({
            userId: r.userId,
            type: "NEW_CHAPTER" as const,
            title: title.slice(0, 200),
            body: body.slice(0, 1000),
            href,
            meta,
          })),
        });
      } catch {
        await this.db.notification.createMany({
          data: targets.map((r: { userId: string }) => ({
            userId: r.userId,
            type: "NEW_CHAPTER" as const,
            title: title.slice(0, 200),
            body: body.slice(0, 1000),
            href,
          })),
        });
      }
      notifiedCount += targets.length;
    }
    this.log.log(`Notified ${notifiedCount} bookmarkers of chapter ${chapterId}`);
    return { notifiedCount };
  }

  /**
   * Sends an admin-only notification when a chapter is automatically published or fails synchronization.
   * Normal users never receive these notifications.
   * Guarantees idempotency: only one admin publication alert is created per (adminUserId, chapterId).
   */
  async notifyAdminsChapterEvent(payload: AdminChapterAlertPayload) {
    const admins = await this.db.user.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        role: { name: "ADMIN" },
      },
      select: { id: true },
    }).catch(() => [] as { id: string }[]);

    if (!admins.length) return { notifiedAdmins: 0 };

    const isSuccess = payload.status === "PUBLISHED";
    const title = isSuccess
      ? `New chapter automatically published: ${payload.comicTitle}`
      : `[Admin Alert] Chapter synchronization failed: ${payload.comicTitle}`;

    const chapterMapping =
      payload.originalLabel &&
      payload.originalLabel.toLowerCase() !== `chapter ${payload.displayNumber}`.toLowerCase()
        ? `${payload.originalLabel} → Chapter ${payload.displayNumber}`
        : `Chapter ${payload.displayNumber}`;

    const sourceReleaseStr = formatReadableDate(payload.sourceReleaseDate, false);
    const publishedOnStr = formatReadableDate(payload.publishedAt ?? new Date(), true);

    const bodyLines = isSuccess
      ? [
          `Comic: ${payload.comicTitle}`,
          `Provider: ${payload.providerName}`,
          `Chapter: ${chapterMapping}${payload.chapterTitle ? ` (${payload.chapterTitle})` : ""}`,
          `Source release: ${sourceReleaseStr}`,
          `Published on ComicVerse: ${publishedOnStr}`,
          `Status: Successfully Published`,
        ]
      : [
          `Comic: ${payload.comicTitle}`,
          `Provider: ${payload.providerName}`,
          `Chapter: ${chapterMapping}${payload.chapterTitle ? ` (${payload.chapterTitle})` : ""}`,
          `Status: Failed (${payload.errorMessage ?? "Content retrieval error"})`,
        ];

    const body = bodyLines.join(" · ");
    const href = payload.chapterUrl ?? `/admin/chapters?comicId=${encodeURIComponent(payload.comicId)}`;
    const meta = {
      adminOnly: true,
      event: isSuccess ? "AUTO_CHAPTER_PUBLISHED" : "AUTO_CHAPTER_FAILED",
      comicId: payload.comicId,
      comicTitle: payload.comicTitle,
      comicSlug: payload.comicSlug,
      providerId: payload.providerId,
      providerName: payload.providerName,
      chapterId: payload.chapterId ?? null,
      externalChapterId: payload.externalChapterId ?? null,
      chapterNumber: payload.chapterNumber,
      displayNumber: payload.displayNumber,
      originalLabel: payload.originalLabel ?? null,
      chapterTitle: payload.chapterTitle ?? null,
      sourceReleaseDate: payload.sourceReleaseDate ? new Date(payload.sourceReleaseDate).toISOString() : null,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt).toISOString() : new Date().toISOString(),
      status: payload.status,
      chapterUrl: payload.chapterUrl ?? null,
      sourceUrl: payload.sourceUrl ?? null,
      errorMessage: payload.errorMessage ?? null,
    };

    let createdCount = 0;
    for (const admin of admins) {
      // Idempotency check: ensure only 1 admin publication alert per chapterId per admin
      if (isSuccess && payload.chapterId) {
        const existing = await this.db.notification.findFirst({
          where: {
            userId: admin.id,
            type: "PLATFORM",
            href,
          },
          select: { id: true },
        }).catch(() => null);
        if (existing) continue;
      }
      await this.push(admin.id, "PLATFORM", title, body, href, meta);
      createdCount++;
    }
    return { notifiedAdmins: createdCount };
  }

  /**
   * Lists operational & automatic chapter publication notifications exclusively for authorized ADMIN users.
   * Supports filters: All, Published, Failed, WeebCentral, AsuraScans.
   */
  async listAdminOperationalNotifications(
    adminUserId: string,
    opts?: {
      filter?: "all" | "published" | "failed" | "weebcentral" | "asurascans";
      page?: number;
    },
  ) {
    const filter = (opts?.filter ?? "all").toLowerCase();
    const page = Math.max(1, opts?.page ?? 1);

    const rows = await this.db.notification.findMany({
      where: {
        userId: adminUserId,
        type: "PLATFORM",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const adminAlerts = rows.filter((r: any) => this.isAdminNotification(r));
    const filtered = adminAlerts.filter((r: any) => {
      const m = r.meta && typeof r.meta === "object" ? (r.meta as any) : {};
      const status = String(m.status ?? (r.title?.includes("failed") ? "FAILED" : "PUBLISHED")).toUpperCase();
      const providerId = String(m.providerId ?? (r.body?.toLowerCase().includes("asura") ? "asurascans" : "weebcentral")).toLowerCase();
      if (filter === "published") return status === "PUBLISHED";
      if (filter === "failed") return status === "FAILED";
      if (filter === "weebcentral") return providerId === "weebcentral";
      if (filter === "asurascans") return providerId === "asurascans";
      return true;
    });

    const start = (page - 1) * 25;
    return {
      total: filtered.length,
      page,
      filter,
      items: filtered.slice(start, start + 25),
    };
  }
}

@ApiTags("notifications")
@Authenticated()
@Controller("user")
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get("notifications") list(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    return this.svc.list(u.id, q.page, q.group, u.role);
  }
  @HttpCode(204) @Post("notifications/read") read(@CurrentUser() u: AuthUser, @Body() d: ReadDto) {
    return this.svc.markRead(u.id, d.ids);
  }
  @HttpCode(204) @Put("notification-settings") settings(@CurrentUser() u: AuthUser, @Body() d: SettingsDto) {
    return this.svc.setPrefs(u.id, d.newChapter);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
