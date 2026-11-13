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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsModule = exports.AnalyticsController = exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/auth.guard");
const optional_user_1 = require("../common/optional-user");
const TYPES = ["PAGE_VIEW", "COMIC_VIEW", "CHAPTER_VIEW", "SEARCH", "READ_SESSION"];
class EventDto {
    type;
    comicId;
    chapterId;
    path;
    query;
}
__decorate([
    (0, class_validator_1.IsIn)(TYPES),
    __metadata("design:type", String)
], EventDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], EventDto.prototype, "comicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], EventDto.prototype, "chapterId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], EventDto.prototype, "path", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], EventDto.prototype, "query", void 0);
class RangeQuery {
    days = 30;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(90),
    __metadata("design:type", Number)
], RangeQuery.prototype, "days", void 0);
let AnalyticsService = class AnalyticsService {
    db;
    constructor(db) {
        this.db = db;
    }
    // The browser only calls this after the visitor accepts the consent banner. No IP address or cookie id is stored.
    async record(userId, d) {
        let comicId = d.comicId;
        if (d.type === "COMIC_VIEW" && comicId) {
            const r = await this.db.comic.updateMany({ where: {
                    id: comicId, publishState: "PUBLISHED", deletedAt: null,
                    OR: this.db.publicComicOrFilter,
                }, data: { views: { increment: 1 } } });
            if (!r.count)
                comicId = undefined;
        }
        await this.db.analyticsEvent.create({ data: { type: d.type, userId, comicId, chapterId: d.chapterId,
                path: d.path?.split("?")[0], query: d.type === "SEARCH" ? d.query?.trim().toLowerCase() : undefined } });
    }
    async summary(days) {
        const since = new Date(Date.now() - days * 864e5);
        const [daily, dau, searches, comicViews] = await Promise.all([
            this.db.$queryRaw(client_1.Prisma.sql `SELECT date_trunc('day', "createdAt")::date AS day, "type", COUNT(*)::int AS n FROM "AnalyticsEvent" WHERE "createdAt" >= ${since} GROUP BY 1, 2 ORDER BY 1`),
            this.db.$queryRaw(client_1.Prisma.sql `SELECT date_trunc('day', "createdAt")::date AS day, COUNT(DISTINCT "userId")::int AS n FROM "AnalyticsEvent" WHERE "createdAt" >= ${since} AND "userId" IS NOT NULL GROUP BY 1 ORDER BY 1`),
            this.db.analyticsEvent.groupBy({ by: ["query"], where: { type: "SEARCH", createdAt: { gte: since }, query: { not: null } }, _count: { _all: true }, orderBy: { _count: { query: "desc" } }, take: 10 }),
            this.db.analyticsEvent.groupBy({ by: ["comicId"], where: { type: "COMIC_VIEW", createdAt: { gte: since }, comicId: { not: null } }, _count: { _all: true }, orderBy: { _count: { comicId: "desc" } }, take: 100 }),
        ]);
        const ids = comicViews.map((c) => c.comicId);
        const [comics, links] = await Promise.all([
            this.db.comic.findMany({ where: { id: { in: ids.slice(0, 10) } }, select: { id: true, title: true } }),
            this.db.comicGenre.findMany({ where: { comicId: { in: ids } }, include: { genre: { select: { name: true } } } }),
        ]);
        const title = new Map(comics.map((c) => [c.id, c.title]));
        const views = new Map(comicViews.map((c) => [c.comicId, c._count._all]));
        const genres = new Map();
        for (const l of links)
            genres.set(l.genre.name, (genres.get(l.genre.name) ?? 0) + (views.get(l.comicId) ?? 0));
        const iso = (d) => d.toISOString().slice(0, 10);
        return {
            days, daily: daily.map((r) => ({ day: iso(r.day), type: r.type, n: r.n })), activeUsers: dau.map((r) => ({ day: iso(r.day), n: r.n })),
            topSearches: searches.map((s) => ({ query: s.query, n: s._count._all })),
            topComics: comicViews.slice(0, 10).map((c) => ({ title: title.get(c.comicId) ?? "(removed)", n: c._count._all })),
            topGenres: [...genres].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
        };
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object])
], AnalyticsService);
let AnalyticsController = class AnalyticsController {
    svc;
    db;
    constructor(svc, db) {
        this.svc = svc;
        this.db = db;
    }
    async event(req, d) { await this.svc.record(await (0, optional_user_1.optionalUserId)(this.db, req), d); }
    summary(q) { return this.svc.summary(q.days); }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60_000 } }),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("analytics/event"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, EventDto]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "event", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("audit:read"),
    (0, common_1.Get)("admin/analytics"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RangeQuery]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "summary", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, swagger_1.ApiTags)("analytics"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [AnalyticsService, typeof (_b = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _b : Object])
], AnalyticsController);
let AnalyticsModule = class AnalyticsModule {
};
exports.AnalyticsModule = AnalyticsModule;
exports.AnalyticsModule = AnalyticsModule = __decorate([
    (0, common_1.Module)({ controllers: [AnalyticsController], providers: [AnalyticsService] })
], AnalyticsModule);
