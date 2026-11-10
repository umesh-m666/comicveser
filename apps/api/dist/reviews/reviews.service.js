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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsModule = exports.ReviewsController = exports.ReviewsService = exports.ReportDto = exports.ISSUE_CATEGORIES = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const mail_service_1 = require("../mail/mail.service");
const config_1 = require("../common/config");
exports.ISSUE_CATEGORIES = [
    "BUG",
    "BROKEN_CHAPTER",
    "LOGIN_ISSUE",
    "CONTENT_ISSUE",
    "FEATURE_REQUEST",
    "ABUSE",
    "GENERAL",
];
class RateDto {
    value;
}
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], RateDto.prototype, "value", void 0);
class BodyDto {
    body;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 2000),
    __metadata("design:type", String)
], BodyDto.prototype, "body", void 0);
class CommentDto extends BodyDto {
    parentId;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CommentDto.prototype, "parentId", void 0);
class ReportDto {
    targetType;
    targetId;
    category;
    subject;
    description;
    reason;
    comicId;
    chapterId;
}
exports.ReportDto = ReportDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["comic", "chapter", "review", "comment", "platform", "account"]),
    __metadata("design:type", String)
], ReportDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], ReportDto.prototype, "targetId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.ISSUE_CATEGORIES),
    __metadata("design:type", String)
], ReportDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], ReportDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 2000),
    __metadata("design:type", String)
], ReportDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 2000),
    __metadata("design:type", String)
], ReportDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], ReportDto.prototype, "comicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], ReportDto.prototype, "chapterId", void 0);
let ReviewsService = class ReviewsService {
    db;
    notif;
    mail;
    log = new common_1.Logger("Reviews");
    constructor(db, notif, mail) {
        this.db = db;
        this.notif = notif;
        this.mail = mail;
    }
    async forComic(comicId) {
        const [reviews, comments, agg] = await Promise.all([
            this.db.review.findMany({
                where: { comicId, deletedAt: null },
                orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
                take: 30,
                include: { user: { select: { id: true, username: true, profile: { select: { avatarUrl: true } } } } },
            }),
            this.db.comment.findMany({
                where: { comicId, parentId: null, deletedAt: null },
                orderBy: { createdAt: "desc" },
                take: 30,
                include: {
                    user: { select: { id: true, username: true } },
                    replies: {
                        where: { deletedAt: null },
                        orderBy: { createdAt: "asc" },
                        include: { user: { select: { id: true, username: true } } },
                    },
                },
            }),
            this.db.rating.aggregate({
                where: { comicId },
                _avg: { value: true },
                _count: { value: true },
            }),
        ]);
        return {
            rating: { average: agg._avg.value ?? 0, count: agg._count.value },
            reviews,
            comments,
        };
    }
    rate(userId, comicId, value) {
        return this.db.rating.upsert({
            where: { userId_comicId: { userId, comicId } },
            create: { userId, comicId, value },
            update: { value },
        });
    }
    upsertReview(userId, comicId, body) {
        return this.db.review.upsert({
            where: { userId_comicId: { userId, comicId } },
            create: { userId, comicId, body },
            update: { body, deletedAt: null },
        });
    }
    async voteHelpful(userId, reviewId) {
        const exists = await this.db.reviewVote.findUnique({
            where: { userId_reviewId: { userId, reviewId } },
        });
        if (exists)
            return;
        await this.db.$transaction([
            this.db.reviewVote.create({ data: { userId, reviewId } }),
            this.db.review.update({
                where: { id: reviewId },
                data: { helpfulCount: { increment: 1 } },
            }),
        ]);
    }
    async comment(userId, comicId, d) {
        const c = await this.db.comment.create({
            data: { userId, comicId, body: d.body, parentId: d.parentId },
        });
        if (d.parentId) {
            const parent = await this.db.comment.findUnique({ where: { id: d.parentId } });
            if (parent && parent.userId !== userId) {
                await this.notif.push(parent.userId, "REVIEW_REPLY", "New reply to your comment", d.body.slice(0, 120));
            }
        }
        return c;
    }
    async deleteComment(u, id) {
        const c = await this.db.comment.findUnique({ where: { id } });
        if (!c)
            throw new common_1.NotFoundException();
        if (c.userId !== u.id && !u.permissions.includes("review:moderate")) {
            throw new common_1.ForbiddenException();
        }
        await this.db.comment.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    async deleteReview(u, id) {
        const r = await this.db.review.findUnique({ where: { id } });
        if (!r)
            throw new common_1.NotFoundException();
        if (r.userId !== u.id && !u.permissions.includes("review:moderate")) {
            throw new common_1.ForbiddenException();
        }
        await this.db.review.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    async report(u, d) {
        const description = (d.description ?? d.reason ?? "").trim();
        const subject = (d.subject ?? "").trim() || description.slice(0, 80) || "User Issue Report";
        if (description.length < 3 && (d.reason ?? "").trim().length < 3) {
            throw new common_1.BadRequestException("Please provide a description or reason (at least 3 characters).");
        }
        const category = (d.category ||
            (d.targetType === "chapter"
                ? "BROKEN_CHAPTER"
                : d.targetType === "comic"
                    ? "CONTENT_ISSUE"
                    : d.targetType === "comment" || d.targetType === "review"
                        ? "ABUSE"
                        : "GENERAL")).toUpperCase();
        const targetType = d.targetType ?? (d.chapterId ? "chapter" : d.comicId ? "comic" : "platform");
        const targetId = d.targetId ?? d.chapterId ?? d.comicId ?? "general";
        const combinedReason = d.reason?.trim() ||
            (d.subject ? `[${category}] ${subject}: ${description}` : description).slice(0, 500);
        const comicId = d.comicId ?? (targetType === "comic" && targetId !== "general" ? targetId : null);
        const chapterId = d.chapterId ?? (targetType === "chapter" && targetId !== "general" ? targetId : null);
        let created;
        try {
            created = await this.db.report.create({
                data: {
                    reporterId: u.id,
                    targetType,
                    targetId,
                    category,
                    subject,
                    description: description || combinedReason,
                    reason: combinedReason,
                    comicId,
                    chapterId,
                    isRead: false,
                },
                include: {
                    reporter: { select: { id: true, username: true, email: true } },
                },
            });
        }
        catch {
            // Fallback if Prisma client DMMF predates extended Report columns
            created = await this.db.report.create({
                data: {
                    reporterId: u.id,
                    targetType,
                    targetId,
                    reason: combinedReason,
                },
                include: {
                    reporter: { select: { id: true, username: true, email: true } },
                },
            });
            try {
                await this.db.$executeRawUnsafe(`UPDATE "Report"
           SET "category" = $1, "subject" = $2, "description" = $3, "comicId" = $4, "chapterId" = $5, "isRead" = false
           WHERE "id" = $6`, category, subject, description || combinedReason, comicId, chapterId, created.id);
            }
            catch {
                // Ignore in mock environment
            }
            created = {
                ...created,
                category,
                subject,
                description: description || combinedReason,
                comicId,
                chapterId,
                isRead: false,
            };
        }
        // Notify all active ADMIN users in-app (and via email if configured)
        try {
            const admins = await this.db.user.findMany({
                where: {
                    status: "ACTIVE",
                    deletedAt: null,
                    role: { name: "ADMIN" },
                },
                select: { id: true, email: true, username: true },
            });
            const alertTitle = `New Issue Report (${category}): ${subject.slice(0, 80)}`;
            const alertBody = `@${u.username} (${u.email}): ${(description || combinedReason).slice(0, 240)}`;
            await Promise.all(admins.map((admin) => this.notif
                .push(admin.id, "PLATFORM", alertTitle, alertBody, "/admin/reviews")
                .catch(() => undefined)));
            for (const admin of admins) {
                if (admin.email) {
                    void this.mail
                        .sendAdminIssueAlertEmail(admin.email, {
                        id: created.id,
                        username: u.username,
                        email: u.email,
                        category,
                        subject,
                        description: description || combinedReason,
                        adminUrl: `${(0, config_1.primaryWebOrigin)()}/admin/reviews`,
                    })
                        .catch((err) => {
                        this.log.warn(`Admin alert email failed for ${admin.email}: ${err.message}`);
                    });
                }
            }
        }
        catch (err) {
            this.log.warn(`Failed to fan out admin notifications for report ${created.id}: ${err.message}`);
        }
        return {
            id: created.id,
            reporterId: u.id,
            username: created.reporter?.username ?? u.username,
            email: created.reporter?.email ?? u.email,
            category: created.category ?? category,
            subject: created.subject ?? subject,
            description: created.description ?? (description || combinedReason),
            reason: created.reason ?? combinedReason,
            targetType: created.targetType,
            targetId: created.targetId,
            comicId: created.comicId ?? comicId,
            chapterId: created.chapterId ?? chapterId,
            status: created.status ?? "OPEN",
            isRead: Boolean(created.isRead),
            adminResponse: created.adminResponse ?? null,
            respondedAt: created.respondedAt ?? null,
            createdAt: created.createdAt,
            resolvedAt: created.resolvedAt ?? null,
        };
    }
    async myReports(userId) {
        const items = await this.db.report.findMany({
            where: { reporterId: userId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        return items.map((r) => ({
            id: r.id,
            category: r.category ?? "GENERAL",
            subject: r.subject || r.reason?.slice(0, 80) || "Issue report",
            description: r.description || r.reason || "",
            reason: r.reason,
            targetType: r.targetType,
            targetId: r.targetId,
            comicId: r.comicId ?? null,
            chapterId: r.chapterId ?? null,
            status: r.status,
            adminResponse: r.adminResponse ?? null,
            respondedAt: r.respondedAt ?? null,
            createdAt: r.createdAt,
            resolvedAt: r.resolvedAt ?? null,
        }));
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object, typeof (_b = typeof notifications_service_1.NotificationsService !== "undefined" && notifications_service_1.NotificationsService) === "function" ? _b : Object, typeof (_c = typeof mail_service_1.MailService !== "undefined" && mail_service_1.MailService) === "function" ? _c : Object])
], ReviewsService);
let ReviewsController = class ReviewsController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    forComic(id) {
        return this.svc.forComic(id);
    }
    rate(u, id, d) {
        return this.svc.rate(u.id, id, d.value);
    }
    review(u, id, d) {
        return this.svc.upsertReview(u.id, id, d.body);
    }
    helpful(u, id) {
        return this.svc.voteHelpful(u.id, id);
    }
    delReview(u, id) {
        return this.svc.deleteReview(u, id);
    }
    comment(u, id, d) {
        return this.svc.comment(u.id, id, d);
    }
    delComment(u, id) {
        return this.svc.deleteComment(u, id);
    }
    report(u, d) {
        return this.svc.report(u, d);
    }
    myReports(u) {
        return this.svc.myReports(u.id);
    }
};
exports.ReviewsController = ReviewsController;
__decorate([
    (0, common_1.Get)("comics/:comicId/engagement"),
    __param(0, (0, common_1.Param)("comicId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "forComic", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Post)("comics/:comicId/rating"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_d = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _d : Object, String, RateDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "rate", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Post)("comics/:comicId/reviews"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _e : Object, String, BodyDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "review", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("reviews/:id/helpful"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _f : Object, String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "helpful", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("reviews/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_g = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _g : Object, String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "delReview", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Post)("comics/:comicId/comments"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("comicId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _h : Object, String, CommentDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "comment", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("comments/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_j = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _j : Object, String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "delComment", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Post)("reports"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _k : Object, ReportDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "report", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("reports/mine"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_l = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _l : Object]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "myReports", null);
exports.ReviewsController = ReviewsController = __decorate([
    (0, swagger_1.ApiTags)("reviews"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ReviewsService])
], ReviewsController);
let ReviewsModule = class ReviewsModule {
};
exports.ReviewsModule = ReviewsModule;
exports.ReviewsModule = ReviewsModule = __decorate([
    (0, common_1.Module)({
        controllers: [ReviewsController],
        providers: [ReviewsService],
        exports: [ReviewsService],
    })
], ReviewsModule);
