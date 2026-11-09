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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceModule = exports.MaintenanceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const OPEN = ["DRAFT", "PENDING", "UNPUBLISHED"];
/** Background housekeeping. Set DISABLE_JOBS=true on instances that should not run it (e.g. extra replicas, tests). */
let MaintenanceService = class MaintenanceService {
    db;
    notes;
    log = new common_1.Logger("Maintenance");
    timers = [];
    constructor(db, notes) {
        this.db = db;
        this.notes = notes;
    }
    onModuleInit() {
        if (process.env.DISABLE_JOBS === "true")
            return;
        const every = (ms, fn, name) => { const t = setInterval(() => fn().catch((e) => this.log.error(`${name}: ${e.message}`)), ms); t.unref(); this.timers.push(t); };
        every(60_000, () => this.publishDue(), "publishDue");
        every(6 * 3600_000, () => this.cleanup(), "cleanup");
    }
    onModuleDestroy() { this.timers.forEach(clearInterval); }
    /** Publishes chapters whose scheduled time has passed. Safe if two instances race: only one update succeeds. */
    async publishDue() {
        const due = await this.db.chapter.findMany({ where: { deletedAt: null, scheduledAt: { lte: new Date() }, publishState: { in: [...OPEN] }, images: { some: {} } }, select: { id: true, comicId: true }, take: 50 });
        for (const c of due) {
            const won = await this.db.$transaction(async (tx) => {
                const r = await tx.chapter.updateMany({ where: { id: c.id, publishState: { in: [...OPEN] } }, data: { publishState: "PUBLISHED", publishedAt: new Date(), scheduledAt: null } });
                if (!r.count)
                    return false;
                await tx.comic.update({ where: { id: c.comicId }, data: { updatedAt: new Date() } });
                await tx.auditLog.create({ data: { actorLabel: "scheduler", action: "chapter.scheduled_publish", resource: "Chapter", resourceId: c.id } });
                return true;
            });
            if (won)
                void this.notes.notifyNewChapter(c.comicId, c.id).catch(() => undefined);
        }
        if (due.length)
            this.log.log(`Checked ${due.length} scheduled chapter(s)`);
    }
    /** Removes expired sessions and tokens, and analytics older than 400 days. */
    async cleanup() {
        const now = Date.now();
        const [s, t, a] = await Promise.all([
            this.db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
            this.db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 7 * 864e5) } } }),
            this.db.analyticsEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 400 * 864e5) } } }),
        ]);
        this.log.log(`Cleanup removed ${s.count} sessions, ${t.count} tokens, ${a.count} analytics rows`);
    }
};
exports.MaintenanceService = MaintenanceService;
exports.MaintenanceService = MaintenanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, notifications_service_1.NotificationsService])
], MaintenanceService);
let MaintenanceModule = class MaintenanceModule {
};
exports.MaintenanceModule = MaintenanceModule;
exports.MaintenanceModule = MaintenanceModule = __decorate([
    (0, common_1.Module)({ providers: [MaintenanceService] })
], MaintenanceModule);
//# sourceMappingURL=maintenance.service.js.map