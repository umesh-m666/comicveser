"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const argon2 = __importStar(require("argon2"));
const prisma_service_1 = require("../prisma/prisma.service");
const comicBrief = {
    select: { id: true, slug: true, title: true, type: true, chapters: {
            where: { publishState: "PUBLISHED", deletedAt: null }, orderBy: { number: "desc" }, take: 1,
            select: { id: true, number: true, publishedAt: true, sourceChapter: { select: { numberLabel: true } } }
        } },
};
let UserService = class UserService {
    db;
    constructor(db) {
        this.db = db;
    }
    get visibleComic() {
        return {
            publishState: "PUBLISHED",
            deletedAt: null,
            OR: this.db.publicComicOrFilter,
        };
    }
    async profile(id) {
        const u = await this.db.user.findUniqueOrThrow({ where: { id }, include: { profile: true } });
        return { id: u.id, username: u.username, email: u.email, createdAt: u.createdAt, avatarUrl: u.profile?.avatarUrl ?? null, bio: u.profile?.bio ?? null };
    }
    async updateProfile(id, d) {
        await this.db.user.update({ where: { id }, data: {
                ...(d.username && { username: d.username }),
                profile: { upsert: { create: { bio: d.bio }, update: { ...(d.bio !== undefined && { bio: d.bio }) } } },
            } });
        return this.profile(id);
    }
    async changePassword(id, sessionId, d) {
        const u = await this.db.user.findUniqueOrThrow({ where: { id } });
        if (!(await argon2.verify(u.passwordHash, d.current).catch(() => false)))
            throw new common_1.UnauthorizedException("Current password is incorrect.");
        const passwordHash = await argon2.hash(d.next, { type: argon2.argon2id });
        await this.db.$transaction([
            this.db.user.update({ where: { id }, data: { passwordHash } }),
            this.db.session.deleteMany({ where: { userId: id, NOT: { id: sessionId } } }), // keep this device signed in
        ]);
    }
    async bookmarks(userId, q) {
        const where = { userId, comic: { ...this.visibleComic, ...(q.q && { title: { contains: q.q, mode: "insensitive" } }) } };
        const take = 24;
        const [total, items] = await this.db.$transaction([
            this.db.bookmark.count({ where }),
            this.db.bookmark.findMany({ where, include: { comic: comicBrief }, take, skip: (q.page - 1) * take,
                orderBy: q.sort === "title" ? { comic: { title: "asc" } } : { createdAt: "desc" } }),
        ]);
        return { total, page: q.page, items: items.map((b) => {
                const { sourceChapter, ...latest } = b.comic.chapters[0] ?? {};
                return { bookmarkedAt: b.createdAt, comic: { ...b.comic, latestChapter: b.comic.chapters[0] ? { ...latest, displayNumber: sourceChapter ? sourceChapter.numberLabel ?? "Special" : String(latest.number) } : null, chapters: undefined } };
            }) };
    }
    async isBookmarked(userId, comicId) {
        return { bookmarked: !!(await this.db.bookmark.findFirst({ where: { userId, comicId, comic: this.visibleComic }, select: { id: true } })) };
    }
    async addBookmark(userId, comicId) {
        const c = await this.db.comic.findFirst({ where: { id: comicId, ...this.visibleComic }, select: { id: true } });
        if (!c)
            throw new common_1.NotFoundException("Comic not found.");
        await this.db.bookmark.upsert({ where: { userId_comicId: { userId, comicId } }, update: {}, create: { userId, comicId } }); // idempotent; DB unique prevents duplicates
    }
    async removeBookmark(userId, comicId) { await this.db.bookmark.deleteMany({ where: { userId, comicId } }); }
    async saveProgress(userId, d) {
        const ch = await this.db.chapter.findFirst({ where: { id: d.chapterId, comicId: d.comicId, publishState: "PUBLISHED", deletedAt: null, comic: this.visibleComic, OR: [{ sourceChapter: { is: null } }, { sourceChapter: { is: { sourceTitle: { state: "APPROVED" } } } }] }, select: { id: true } });
        if (!ch)
            throw new common_1.BadRequestException("That chapter does not belong to this comic.");
        const data = { chapterId: d.chapterId, imageIndex: d.imageIndex, scrollY: d.scrollY };
        await this.db.readingHistory.upsert({ where: { userId_comicId: { userId, comicId: d.comicId } }, update: data, create: { userId, comicId: d.comicId, ...data } });
    }
    async history(userId) {
        const rows = await this.db.readingHistory.findMany({ where: { userId, comic: this.visibleComic, chapter: { publishState: "PUBLISHED", deletedAt: null, OR: [{ sourceChapter: { is: null } }, { sourceChapter: { is: { sourceTitle: { state: "APPROVED" } } } }] } }, orderBy: { updatedAt: "desc" }, take: 50,
            include: { comic: { select: { id: true, slug: true, title: true } }, chapter: { select: { id: true, number: true, title: true, sourceChapter: { select: { numberLabel: true } } } } } });
        return rows.map((r) => {
            const { sourceChapter, ...chapter } = r.chapter;
            return { comic: r.comic, chapter: { ...chapter, displayNumber: sourceChapter ? sourceChapter.numberLabel ?? "Special" : String(chapter.number) }, imageIndex: r.imageIndex, scrollY: r.scrollY, lastReadAt: r.updatedAt };
        });
    }
    async reviews(userId) {
        const rows = await this.db.review.findMany({ where: { userId, deletedAt: null, comic: this.visibleComic }, orderBy: { createdAt: "desc" }, take: 100, include: { comic: { select: { slug: true, title: true } } } });
        const ratings = await this.db.rating.findMany({ where: { userId, comicId: { in: rows.map((r) => r.comicId) } }, select: { comicId: true, value: true } });
        const rm = new Map(ratings.map((r) => [r.comicId, r.value]));
        return rows.map((r) => ({ id: r.id, body: r.body, helpfulCount: r.helpfulCount, createdAt: r.createdAt, comic: r.comic, rating: rm.get(r.comicId) ?? null }));
    }
    /** Removes personal data and signs the user out everywhere. The row stays (anonymised) so payment records and ratings keep working. */
    async deleteAccount(userId, password) {
        const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });
        if (u.role.name === "ADMIN")
            throw new common_1.ForbiddenException("Admin accounts can't be deleted here.");
        if (!(await argon2.verify(u.passwordHash, password).catch(() => false)))
            throw new common_1.UnauthorizedException("Password is incorrect.");
        await this.db.$transaction([
            this.db.session.deleteMany({ where: { userId } }), this.db.authToken.deleteMany({ where: { userId } }),
            this.db.bookmark.deleteMany({ where: { userId } }), this.db.readingHistory.deleteMany({ where: { userId } }),
            this.db.notification.deleteMany({ where: { userId } }), this.db.reviewVote.deleteMany({ where: { userId } }),
            this.db.userProfile.deleteMany({ where: { userId } }),
            this.db.externalLibraryEntry.deleteMany({ where: { userId } }),
            this.db.review.updateMany({ where: { userId }, data: { deletedAt: new Date(), body: "[deleted]" } }),
            this.db.user.update({ where: { id: userId }, data: { deletedAt: new Date(), status: "SUSPENDED", email: `deleted-${userId}@deleted.invalid`, username: `deleted-${userId.slice(-10)}`, passwordHash: "!" } }),
            this.db.auditLog.create({ data: { actorId: userId, action: "user.delete_self", resource: "User", resourceId: userId } }),
        ]);
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserService);
//# sourceMappingURL=user.service.js.map