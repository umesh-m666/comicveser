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
exports.ReviewsModule = exports.ReviewsController = exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/auth.guard");
class RatingDto {
    value;
}
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], RatingDto.prototype, "value", void 0);
class ReviewDto {
    body;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 3000),
    __metadata("design:type", String)
], ReviewDto.prototype, "body", void 0);
class ReportDto {
    targetType;
    targetId;
    reason;
}
__decorate([
    (0, class_validator_1.IsIn)(["REVIEW", "COMIC", "COMMENT"]),
    __metadata("design:type", String)
], ReportDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], ReportDto.prototype, "targetId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 500),
    __metadata("design:type", String)
], ReportDto.prototype, "reason", void 0);
class PageQuery {
    page = 1;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PageQuery.prototype, "page", void 0);
const write = { default: { limit: 10, ttl: 60_000 } };
let ReviewsService = class ReviewsService {
    db;
    constructor(db) {
        this.db = db;
    }
    async comic(id) {
        if (!(await this.db.comic.findFirst({ where: { id, publishState: "PUBLISHED", deletedAt: null, OR: this.db.publicComicOrFilter }, select: { id: true } })))
            throw new common_1.NotFoundException("Comic not found.");
    }
    async list(comicId, page) {
        await this.comic(comicId);
        const where = { comicId, deletedAt: null };
        const [total, rows, agg] = await Promise.all([
            this.db.review.count({ where }),
            this.db.review.findMany({ where, orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }], skip: (page - 1) * 10, take: 10, include: { user: { select: { id: true, username: true } } } }),
            this.db.rating.aggregate({ where: { comicId }, _avg: { value: true }, _count: true }),
        ]);
        const ratings = await this.db.rating.findMany({ where: { comicId, userId: { in: rows.map((r) => r.userId) } }, select: { userId: true, value: true } });
        const rm = new Map(ratings.map((r) => [r.userId, r.value]));
        return { average: agg._avg.value, ratingCount: agg._count, total, page, pages: Math.max(1, Math.ceil(total / 10)),
            items: rows.map((r) => ({ id: r.id, body: r.body, helpfulCount: r.helpfulCount, createdAt: r.createdAt, user: r.user, rating: rm.get(r.userId) ?? null })) };
    }
    async mine(userId, comicId) {
        await this.comic(comicId);
        const [rating, review] = await Promise.all([
            this.db.rating.findUnique({ where: { userId_comicId: { userId, comicId } } }),
            this.db.review.findFirst({ where: { userId, comicId, deletedAt: null } }),
        ]);
        return { rating: rating?.value ?? null, review: review ? { id: review.id, body: review.body } : null };
    }
    async rate(userId, comicId, value) {
        await this.comic(comicId);
        await this.db.rating.upsert({ where: { userId_comicId: { userId, comicId } }, update: { value }, create: { userId, comicId, value } }); // one rating per user per comic
    }
    async write(u, comicId, body) {
        if (!u.emailVerified)
            throw new common_1.ForbiddenException("Verify your email before writing a review.");
        await this.comic(comicId);
        await this.db.review.upsert({ where: { userId_comicId: { userId: u.id, comicId } }, update: { body, deletedAt: null }, create: { userId: u.id, comicId, body } });
    }
    async update(userId, id, body) {
        const r = await this.db.review.updateMany({ where: { id, userId, deletedAt: null }, data: { body } });
        if (!r.count)
            throw new common_1.NotFoundException("Review not found.");
    }
    async remove(u, id) {
        const rev = await this.db.review.findFirst({ where: { id, deletedAt: null } });
        if (!rev)
            throw new common_1.NotFoundException("Review not found.");
        const mod = u.permissions.includes("review:moderate");
        if (rev.userId !== u.id && !mod)
            throw new common_1.ForbiddenException("You can only delete your own reviews.");
        await this.db.$transaction([
            this.db.review.update({ where: { id }, data: { deletedAt: new Date() } }),
            ...(rev.userId !== u.id ? [this.db.auditLog.create({ data: { actorId: u.id, action: "review.delete", resource: "Review", resourceId: id } })] : []),
        ]);
    }
    async helpful(userId, id) {
        const rev = await this.db.review.findFirst({ where: { id, deletedAt: null } });
        if (!rev)
            throw new common_1.NotFoundException("Review not found.");
        if (rev.userId === userId)
            throw new common_1.ForbiddenException("You can't vote on your own review.");
        try {
            await this.db.$transaction([this.db.reviewVote.create({ data: { userId, reviewId: id } }), this.db.review.update({ where: { id }, data: { helpfulCount: { increment: 1 } } })]);
        }
        catch (e) {
            if (!(e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002"))
                throw e;
        } // already voted
    }
    async report(userId, d) {
        const exists = d.targetType === "REVIEW" ? await this.db.review.findFirst({ where: { id: d.targetId, deletedAt: null }, select: { id: true } })
            : d.targetType === "COMIC" ? await this.db.comic.findFirst({ where: { id: d.targetId, publishState: "PUBLISHED", deletedAt: null, OR: this.db.publicComicOrFilter }, select: { id: true } }) : { id: d.targetId };
        if (!exists)
            throw new common_1.NotFoundException("Nothing to report.");
        if (await this.db.report.findFirst({ where: { reporterId: userId, targetType: d.targetType, targetId: d.targetId, status: "OPEN" }, select: { id: true } }))
            return;
        await this.db.report.create({ data: { reporterId: userId, targetType: d.targetType, targetId: d.targetId, reason: d.reason } });
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReviewsService);
let ReviewsController = class ReviewsController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    list(id, q) { return this.svc.list(id, q.page); }
    mine(u, id) { return this.svc.mine(u.id, id); }
    rate(u, id, d) { return this.svc.rate(u.id, id, d.value); }
    write(u, id, d) { return this.svc.write(u, id, d.body); }
    update(u, id, d) { return this.svc.update(u.id, id, d.body); }
    remove(u, id) { return this.svc.remove(u, id); }
    helpful(u, id) { return this.svc.helpful(u.id, id); }
    report(u, d) { return this.svc.report(u.id, d); }
};
exports.ReviewsController = ReviewsController;
__decorate([
    (0, common_1.Get)("comics/:id/reviews"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PageQuery]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "list", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("comics/:id/mine"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "mine", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, throttler_1.Throttle)(write),
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("comics/:id/rating"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, RatingDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "rate", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, throttler_1.Throttle)(write),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("comics/:id/reviews"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ReviewDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "write", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, throttler_1.Throttle)(write),
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("reviews/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ReviewDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "update", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("reviews/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "remove", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, throttler_1.Throttle)(write),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("reviews/:id/helpful"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "helpful", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, throttler_1.Throttle)(write),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("reports"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ReportDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "report", null);
exports.ReviewsController = ReviewsController = __decorate([
    (0, swagger_1.ApiTags)("reviews"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ReviewsService])
], ReviewsController);
let ReviewsModule = class ReviewsModule {
};
exports.ReviewsModule = ReviewsModule;
exports.ReviewsModule = ReviewsModule = __decorate([
    (0, common_1.Module)({ controllers: [ReviewsController], providers: [ReviewsService] })
], ReviewsModule);
//# sourceMappingURL=reviews.service.js.map