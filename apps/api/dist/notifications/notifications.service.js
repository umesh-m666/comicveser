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
    /** messages = notes from the platform, creators and review replies; alerts = new chapters and bookmark updates. Omitted = everything. */
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
    (0, class_validator_1.IsIn)(["messages", "alerts"]),
    __metadata("design:type", String)
], PageQuery.prototype, "group", void 0);
const GROUPS = {
    messages: ["PLATFORM", "ACCOUNT", "CREATOR_ANNOUNCEMENT", "REVIEW_REPLY"],
    alerts: ["NEW_CHAPTER", "BOOKMARK_UPDATE"],
};
let NotificationsService = class NotificationsService {
    db;
    log = new common_1.Logger("Notifications");
    constructor(db) {
        this.db = db;
    }
    async list(userId, page, group) {
        const typeFilter = group ? { type: { in: [...GROUPS[group]] } } : {};
        const [unread, items, profile] = await Promise.all([
            // `unread` stays the total across groups: it drives the bell badge, while the lists are filtered per page.
            this.db.notification.count({ where: { userId, readAt: null } }),
            this.db.notification.findMany({ where: { userId, ...typeFilter }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20 }),
            this.db.userProfile.findUnique({ where: { userId }, select: { notifyPrefs: true } }),
        ]);
        return { unread, items, prefs: { newChapter: profile?.notifyPrefs?.newChapter !== false } };
    }
    async markRead(userId, ids) {
        await this.db.notification.updateMany({ where: { userId, readAt: null, ...(ids?.length && { id: { in: ids } }) }, data: { readAt: new Date() } });
    }
    async setPrefs(userId, newChapter) {
        await this.db.userProfile.upsert({ where: { userId }, update: { notifyPrefs: { newChapter } }, create: { userId, notifyPrefs: { newChapter } } });
    }
    /** Fans out to bookmarkers in batches of 500. In-process for now; move to a queue (BullMQ + Redis) for large audiences. */
    async notifyNewChapter(comicId, chapterId) {
        const ch = await this.db.chapter.findUnique({ where: { id: chapterId }, select: { number: true, comic: { select: { title: true, slug: true } } } });
        if (!ch)
            return;
        let cursor;
        for (;;) {
            const rows = await this.db.bookmark.findMany({ where: { comicId }, orderBy: { id: "asc" }, take: 500, ...(cursor && { skip: 1, cursor: { id: cursor } }),
                select: { id: true, userId: true, user: { select: { profile: { select: { notifyPrefs: true } } } } } });
            if (!rows.length)
                break;
            cursor = rows[rows.length - 1].id;
            const targets = rows.filter((r) => r.user.profile?.notifyPrefs?.newChapter !== false);
            if (targets.length)
                await this.db.notification.createMany({ data: targets.map((r) => ({ userId: r.userId, type: "NEW_CHAPTER",
                        title: `${ch.comic.title}: new chapter`, body: `Chapter ${ch.number} is out.`, href: `/comics/${ch.comic.slug}/chapter/${chapterId}` })) });
        }
        this.log.log(`Notified bookmarkers of chapter ${chapterId}`);
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
    list(u, q) { return this.svc.list(u.id, q.page, q.group); }
    read(u, d) { return this.svc.markRead(u.id, d.ids); }
    settings(u, d) { return this.svc.setPrefs(u.id, d.newChapter); }
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
    (0, common_1.Module)({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
], NotificationsModule);
//# sourceMappingURL=notifications.service.js.map