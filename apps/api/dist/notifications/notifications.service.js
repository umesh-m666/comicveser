"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = exports.NotificationsController = exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/auth.guard");
const chapter_display_1 = require("../sources/chapter-display");
class ReadDto {
    ids;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ReadDto.prototype, "ids", void 0);
class SettingsDto {
    newChapter;
}
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SettingsDto.prototype, "newChapter", void 0);
class PageQuery {
    page = 1;
    /**
     * chapters / alerts = new chapters, bookmark updates, and (for admins) chapter publication alerts.
     * messages = platform messages, account notices, creator announcements, review replies, and issue responses.
     * Omitted / all = everything the current user is authorized to see.
     */
    group;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PageQuery.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["all", "messages", "alerts", "chapters"]),
    __metadata("design:type", String)
], PageQuery.prototype, "group", void 0);
const GROUPS = {
    messages: ["PLATFORM", "ACCOUNT", "CREATOR_ANNOUNCEMENT", "REVIEW_REPLY"],
    alerts: ["NEW_CHAPTER", "BOOKMARK_UPDATE"],
    chapters: ["NEW_CHAPTER", "BOOKMARK_UPDATE"],
};
function formatReadableDate(val, includeTime = false) {
    if (!val)
        return "Unknown";
    const d = val instanceof Date ? val : new Date(val);
    if (Number.isNaN(d.getTime()) || d.getTime() <= 0)
        return "Unknown";
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
let NotificationsService = class NotificationsService {
    db;
    log = new common_1.Logger("Notifications");
    constructor(db) {
        this.db = db;
    }
    async push(userId, type, title, body, href, meta) {
        try {
            return await this.db.notification.create({
                data: {
                    userId,
                    type,
                    title: title.slice(0, 200),
                    body: body.slice(0, 1000),
                    href: href ?? null,
                    ...(meta ? { meta } : {}),
                },
            });
        }
        catch {
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
    isAdminNotification(item) {
        if (item?.meta && typeof item.meta === "object" && item.meta.adminOnly === true) {
            return true;
        }
        if (typeof item?.title === "string" && (item.title.startsWith("New chapter automatically published") ||
            item.title.startsWith("[Admin Alert]") ||
            item.title.startsWith("Chapter synchronization failed"))) {
            return true;
        }
        return false;
    }
    isAdminChapterCategory(item) {
        if (item?.meta && typeof item.meta === "object") {
            const ev = item.meta.event;
            if (ev === "AUTO_CHAPTER_PUBLISHED" || ev === "AUTO_CHAPTER_FAILED" || ev === "MANUAL_CHAPTER_PUBLISHED") {
                return true;
            }
        }
        if (typeof item?.title === "string" && item.title.startsWith("New chapter automatically published")) {
            return true;
        }
        return false;
    }
    async list(userId, page, group, userRole) {
        let isAdmin = userRole === "ADMIN";
        if (!userRole) {
            try {
                const u = await this.db.user.findUnique({ where: { id: userId }, select: { role: { select: { name: true } } } });
                isAdmin = u?.role?.name === "ADMIN";
            }
            catch {
                isAdmin = false;
            }
        }
        const effectiveGroup = group === "all" ? undefined : group;
        const isChaptersTab = effectiveGroup === "alerts" || effectiveGroup === "chapters";
        const isMessagesTab = effectiveGroup === "messages";
        // Fetch user notifications; if admin and filtering by chapters/messages, include PLATFORM alerts that carry chapter sync metadata
        const typeFilter = isChaptersTab
            ? { type: { in: isAdmin ? ["NEW_CHAPTER", "BOOKMARK_UPDATE", "PLATFORM"] : [...GROUPS.chapters] } }
            : isMessagesTab
                ? { type: { in: [...GROUPS.messages] } }
                : {};
        const [rawItems, allUnreadRaw, profile] = await Promise.all([
            this.db.notification.findMany({
                where: { userId, ...typeFilter },
                orderBy: { createdAt: "desc" },
                take: 100,
            }),
            this.db.notification.findMany({
                where: { userId, readAt: null },
                select: { id: true, type: true, title: true, meta: true },
            }).catch(() => this.db.notification.findMany({
                where: { userId, readAt: null },
                select: { id: true, type: true, title: true },
            })),
            this.db.userProfile.findUnique({ where: { userId }, select: { notifyPrefs: true } }),
        ]);
        // Enforce strict authorization: non-admin users must NEVER see admin-only notifications
        const authorizedItems = (rawItems ?? []).filter((item) => {
            if (!isAdmin && this.isAdminNotification(item))
                return false;
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
        const authorizedUnread = (allUnreadRaw ?? []).filter((item) => isAdmin || !this.isAdminNotification(item)).length;
        const start = (Math.max(1, page) - 1) * 20;
        const pagedItems = authorizedItems.slice(start, start + 20);
        return {
            unread: authorizedUnread,
            items: pagedItems,
            prefs: { newChapter: profile?.notifyPrefs?.newChapter !== false },
        };
    }
    async markRead(userId, ids) {
        await this.db.notification.updateMany({
            where: { userId, readAt: null, ...(ids?.length && { id: { in: ids } }) },
            data: { readAt: new Date() },
        });
    }
    async setPrefs(userId, newChapter) {
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
    async notifyNewChapter(comicId, chapterId, opts) {
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
        }).catch(() => this.db.chapter.findUnique({
            where: { id: chapterId },
            select: {
                number: true,
                title: true,
                publishedAt: true,
                comic: { select: { title: true, slug: true } },
            },
        }));
        if (!ch)
            return { notifiedCount: 0 };
        const sc = ch.sourceChapter;
        const displayNum = opts?.displayNumber ?? (0, chapter_display_1.resolveChapterDisplayNumber)(ch, sc);
        const providerId = opts?.providerId ?? sc?.sourceTitle?.sourceId ?? null;
        const providerName = opts?.providerName ??
            (providerId === "weebcentral" ? "WeebCentral" : providerId === "asurascans" ? "AsuraScans" : providerId);
        const releaseDate = opts?.sourceReleaseDate ?? (0, chapter_display_1.resolveChapterPublishedAt)(ch, sc);
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
        let cursor;
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
            if (!rows.length)
                break;
            cursor = rows[rows.length - 1].id;
            const enabledTargets = rows.filter((r) => r.user?.profile?.notifyPrefs?.newChapter !== false);
            if (!enabledTargets.length)
                continue;
            // Prevent duplicate notifications for the same chapter href
            const existingForChapter = await this.db.notification.findMany({
                where: {
                    userId: { in: enabledTargets.map((t) => t.userId) },
                    type: "NEW_CHAPTER",
                    href,
                },
                select: { userId: true },
            }).catch(() => []);
            const alreadyNotifiedIds = new Set(existingForChapter.map((e) => e.userId));
            const targets = enabledTargets.filter((t) => !alreadyNotifiedIds.has(t.userId));
            if (!targets.length)
                continue;
            try {
                await this.db.notification.createMany({
                    data: targets.map((r) => ({
                        userId: r.userId,
                        type: "NEW_CHAPTER",
                        title: title.slice(0, 200),
                        body: body.slice(0, 1000),
                        href,
                        meta,
                    })),
                });
            }
            catch {
                await this.db.notification.createMany({
                    data: targets.map((r) => ({
                        userId: r.userId,
                        type: "NEW_CHAPTER",
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
    async notifyAdminsChapterEvent(payload) {
        const admins = await this.db.user.findMany({
            where: {
                deletedAt: null,
                status: "ACTIVE",
                role: { name: "ADMIN" },
            },
            select: { id: true },
        }).catch(() => []);
        if (!admins.length)
            return { notifiedAdmins: 0 };
        const isSuccess = payload.status === "PUBLISHED";
        const title = isSuccess
            ? `New chapter automatically published: ${payload.comicTitle}`
            : `[Admin Alert] Chapter synchronization failed: ${payload.comicTitle}`;
        const chapterMapping = payload.originalLabel &&
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
                if (existing)
                    continue;
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
    async listAdminOperationalNotifications(adminUserId, opts) {
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
        const adminAlerts = rows.filter((r) => this.isAdminNotification(r));
        const filtered = adminAlerts.filter((r) => {
            const m = r.meta && typeof r.meta === "object" ? r.meta : {};
            const status = String(m.status ?? (r.title?.includes("failed") ? "FAILED" : "PUBLISHED")).toUpperCase();
            const providerId = String(m.providerId ?? (r.body?.toLowerCase().includes("asura") ? "asurascans" : "weebcentral")).toLowerCase();
            if (filter === "published")
                return status === "PUBLISHED";
            if (filter === "failed")
                return status === "FAILED";
            if (filter === "weebcentral")
                return providerId === "weebcentral";
            if (filter === "asurascans")
                return providerId === "asurascans";
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
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
let NotificationsController = class NotificationsController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    list(u, q) {
        return this.svc.list(u.id, q.page, q.group, u.role);
    }
    read(u, d) {
        return this.svc.markRead(u.id, d.ids);
    }
    settings(u, d) {
        return this.svc.setPrefs(u.id, d.newChapter);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)("notifications"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PageQuery]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("notifications/read"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ReadDto]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "read", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("notification-settings"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, SettingsDto]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "settings", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, swagger_1.ApiTags)("notifications"),
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Controller)("user"),
    __metadata("design:paramtypes", [NotificationsService])
], NotificationsController);
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        controllers: [NotificationsController],
        providers: [NotificationsService],
        exports: [NotificationsService],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.service.js.map