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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationsModule = exports.RecommendationsController = exports.RecommendationsService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../prisma/prisma.service");
const comics_module_1 = require("../comics/comics.module");
const comics_service_1 = require("../comics/comics.service");
const optional_user_1 = require("../common/optional-user");
/** Rule-based for now. Keep this class's public interface stable so a learned model can replace the scoring later. */
let RecommendationsService = class RecommendationsService {
    db;
    comics;
    constructor(db, comics) {
        this.db = db;
        this.comics = comics;
    }
    async forUser(userId) {
        if (!userId)
            return { personalized: false, items: await this.comics.popular() };
        const genres = { select: { genres: { select: { genreId: true } } } };
        const [bms, rated, hist] = await Promise.all([
            this.db.bookmark.findMany({ where: { userId }, select: { comicId: true, comic: genres } }),
            this.db.rating.findMany({ where: { userId, value: { gte: 7 } }, select: { value: true, comic: genres } }),
            this.db.readingHistory.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 50, select: { comicId: true, comic: genres } }),
        ]);
        const w = new Map();
        const add = (gs, weight) => gs.forEach((g) => w.set(g.genreId, (w.get(g.genreId) ?? 0) + weight));
        bms.forEach((b) => add(b.comic.genres, 3)); // bookmarks: strongest signal
        rated.forEach((r) => add(r.comic.genres, (r.value - 6) / 2)); // ratings 7..10 -> 0.5..2
        hist.forEach((h) => add(h.comic.genres, 1)); // reading history
        if (!w.size)
            return { personalized: false, items: await this.comics.popular() };
        const seen = [...new Set([...bms, ...hist].map((x) => x.comicId))];
        const cands = await this.db.comic.findMany({ where: {
                publishState: "PUBLISHED", deletedAt: null, id: { notIn: seen },
                OR: this.db.publicComicOrFilter,
            }, orderBy: { views: "desc" }, take: 200, include: { genres: { include: { genre: true } } } });
        const recent = Date.now() - 30 * 864e5;
        const score = (c) => c.genres.reduce((s, g) => s + (w.get(g.genreId) ?? 0), 0) + Math.log10(c.views + 1) * 0.5 + (c.updatedAt.getTime() > recent ? 1 : 0);
        const top = cands.map((c) => ({ c, s: score(c) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((x) => x.c);
        return { personalized: true, items: await this.comics.withRatings(top) };
    }
};
exports.RecommendationsService = RecommendationsService;
exports.RecommendationsService = RecommendationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object, typeof (_b = typeof comics_service_1.ComicsService !== "undefined" && comics_service_1.ComicsService) === "function" ? _b : Object])
], RecommendationsService);
let RecommendationsController = class RecommendationsController {
    svc;
    db;
    constructor(svc, db) {
        this.svc = svc;
        this.db = db;
    }
    async get(req) { return this.svc.forUser(await (0, optional_user_1.optionalUserId)(this.db, req)); }
};
exports.RecommendationsController = RecommendationsController;
__decorate([
    (0, common_1.Get)("recommendations"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecommendationsController.prototype, "get", null);
exports.RecommendationsController = RecommendationsController = __decorate([
    (0, swagger_1.ApiTags)("recommendations"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [RecommendationsService, typeof (_c = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _c : Object])
], RecommendationsController);
let RecommendationsModule = class RecommendationsModule {
};
exports.RecommendationsModule = RecommendationsModule;
exports.RecommendationsModule = RecommendationsModule = __decorate([
    (0, common_1.Module)({ imports: [comics_module_1.ComicsModule], controllers: [RecommendationsController], providers: [RecommendationsService] })
], RecommendationsModule);
