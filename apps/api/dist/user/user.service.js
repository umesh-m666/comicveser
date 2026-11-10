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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const chapter_display_1 = require("../sources/chapter-display");
const common_1 = require("@nestjs/common");
const argon2 = __importStar(require("argon2"));
const prisma_service_1 = require("../prisma/prisma.service");
const storage_service_1 = require("../storage/storage.service");
const bookmark_status_1 = require("./bookmark-status");
let UserService = class UserService {
    db;
    storage;
    constructor(db, storage) {
        this.db = db;
        this.storage = storage;
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
    /** Chapters a reader may open: published, not deleted, and (for imported titles) from an approved source. */
    get visibleChapter() {
        return { publishState: "PUBLISHED", deletedAt: null, OR: [{ sourceChapter: { is: null } }, { sourceChapter: { is: { sourceTitle: { state: "APPROVED" } } } }] };
    }
    async coverUrl(c) {
        return c.externalCoverUrl ?? (c.coverKey ? await this.storage.readUrl(c.coverKey) : null);
    }
    /** Every visible bookmark with its effective status and reading progress (a library is small, so this is done in one pass). */
    async library(userId, search) {
        const rows = await this.db.bookmark.findMany({
            where: { userId, comic: { AND: [this.visibleComic, ...(search ? [{ OR: [{ title: { contains: search, mode: "insensitive" } }, { altTitle: { contains: search, mode: "insensitive" } }] }] : [])] } },
            take: 1000,
            include: { comic: { select: { id: true, slug: true, title: true, type: true, status: true, coverKey: true, externalCoverUrl: true, chapters: {
                            where: { publishState: "PUBLISHED", deletedAt: null }, orderBy: { number: "desc" }, take: 1,
                            select: { id: true, number: true, title: true, publishedAt: true, sourceChapter: { select: { numberLabel: true, title: true, publishedAt: true } } }
                        } } } },
        });
        const comicIds = rows.map((r) => r.comicId);
        const [totals, reads, history] = await Promise.all([
            this.db.chapter.groupBy({ by: ["comicId"], where: { comicId: { in: comicIds }, ...this.visibleChapter }, _count: { _all: true } }),
            this.db.chapterRead.groupBy({ by: ["comicId"], where: { userId, comicId: { in: comicIds }, chapter: this.visibleChapter }, _count: { _all: true }, _max: { readAt: true } }),
            this.db.readingHistory.findMany({ where: { userId, comicId: { in: comicIds } }, include: { chapter: { select: { id: true, number: true, title: true, sourceChapter: { select: { numberLabel: true, title: true } } } } } }),
        ]);
        const totalBy = new Map(totals.map((t) => [t.comicId, t._count._all]));
        const readBy = new Map(reads.map((r) => [r.comicId, { count: r._count._all, last: r._max.readAt }]));
        const histBy = new Map(history.map((h) => [h.comicId, h]));
        return Promise.all(rows.map(async (b) => {
            const total = totalBy.get(b.comicId) ?? 0;
            const read = readBy.get(b.comicId);
            const hist = histBy.get(b.comicId);
            const manual = b.status ?? null;
            const status = (0, bookmark_status_1.effectiveStatus)({ manual, readCount: read?.count ?? 0, hasHistory: !!hist, totalChapters: total, comicCompleted: b.comic.status === "COMPLETED" });
            const latest = b.comic.chapters[0];
            const latestLabel = latest ? (0, chapter_display_1.resolveChapterDisplayNumber)(latest, latest.sourceChapter) : null;
            const lastUpdatedAt = (latest ? (0, chapter_display_1.resolveChapterPublishedAt)(latest, latest.sourceChapter) : null) ?? b.updatedAt;
            const lastReadAt = hist?.updatedAt ?? read?.last ?? null;
            return {
                title: b.comic.title, bookmarkedAt: b.createdAt, lastUpdatedAt,
                view: {
                    bookmarkedAt: b.createdAt, lastUpdatedAt, status, statusSource: manual ? "manual" : "auto",
                    comic: {
                        id: b.comic.id, slug: b.comic.slug, title: b.comic.title, type: b.comic.type, status: b.comic.status,
                        coverUrl: await this.coverUrl(b.comic), totalChapters: total,
                        latestChapter: latest ? { id: latest.id, number: latest.number, publishedAt: (0, chapter_display_1.resolveChapterPublishedAt)(latest, latest.sourceChapter), displayNumber: latestLabel } : null,
                    },
                    progress: {
                        readCount: read?.count ?? 0, percent: (0, bookmark_status_1.progressPercent)(read?.count ?? 0, total), lastReadAt,
                        current: hist ? { chapterId: hist.chapter.id, number: hist.chapter.number, displayNumber: (0, chapter_display_1.resolveChapterDisplayNumber)(hist.chapter, hist.chapter.sourceChapter), imageIndex: hist.imageIndex } : null,
                    },
                },
            };
        }));
    }
    async bookmarks(userId, q) {
        const all = await this.library(userId, q.q?.trim() || undefined);
        const counts = { ALL: all.length };
        for (const s of bookmark_status_1.BOOKMARK_STATUSES)
            counts[s] = 0;
        all.forEach((r) => { counts[r.view.status] += 1; });
        const wanted = q.status && q.status !== "ALL" ? q.status : null;
        const filtered = (0, bookmark_status_1.sortBookmarks)(all.filter((r) => !wanted || r.view.status === wanted), (0, bookmark_status_1.normalizeSort)(q.sort));
        const size = q.limit ?? 24;
        const items = filtered.slice((q.page - 1) * size, q.page * size).map((r) => r.view);
        return { total: filtered.length, page: q.page, pageSize: size, counts, items };
    }
    /** Sets a manual shelf, or AUTO to hand control back to reading progress. */
    async setBookmarkStatus(userId, comicId, status) {
        const value = status === "AUTO" ? null : status;
        const r = await this.db.bookmark.updateMany({ where: { userId, comicId }, data: { status: value } });
        if (r.count === 0)
            throw new common_1.NotFoundException("Bookmark not found.");
    }
    /** A reader who starts a comic on their Plan to Read shelf is now reading it. */
    async startedReading(userId, comicId) {
        await this.db.bookmark.updateMany({ where: { userId, comicId, status: "PLAN_TO_READ" }, data: { status: null } });
    }
    async markChapterRead(userId, chapterId) {
        const ch = await this.db.chapter.findFirst({ where: { id: chapterId, ...this.visibleChapter, comic: this.visibleComic }, select: { id: true, comicId: true } });
        if (!ch)
            throw new common_1.NotFoundException("Chapter not found.");
        await this.db.chapterRead.upsert({
            where: { userId_chapterId: { userId, chapterId } },
            update: { readAt: new Date() },
            create: { userId, comicId: ch.comicId, chapterId },
        });
        await this.startedReading(userId, ch.comicId);
    }
    async readChapterIds(userId, comicId) {
        const rows = await this.db.chapterRead.findMany({ where: { userId, comicId, chapter: this.visibleChapter }, select: { chapterId: true } });
        return { chapterIds: rows.map((r) => r.chapterId) };
    }
    /** Most recently finished chapters, for the account page. */
    async readChapters(userId) {
        const rows = await this.db.chapterRead.findMany({
            where: { userId, chapter: this.visibleChapter, comic: this.visibleComic }, orderBy: { readAt: "desc" }, take: 30,
            include: { comic: { select: { id: true, slug: true, title: true } }, chapter: { select: { id: true, number: true, title: true, sourceChapter: { select: { numberLabel: true, title: true } } } } },
        });
        return rows.map((r) => ({ comic: r.comic, readAt: r.readAt,
            chapter: { id: r.chapter.id, number: r.chapter.number, displayNumber: (0, chapter_display_1.resolveChapterDisplayNumber)(r.chapter, r.chapter.sourceChapter) } }));
    }
    async stats(userId) {
        const [lib, chaptersRead, comicsStarted] = await Promise.all([
            this.library(userId),
            this.db.chapterRead.count({ where: { userId, chapter: this.visibleChapter, comic: this.visibleComic } }),
            this.db.readingHistory.count({ where: { userId, comic: this.visibleComic } }),
        ]);
        const shelves = {};
        for (const s of bookmark_status_1.BOOKMARK_STATUSES)
            shelves[s] = 0;
        lib.forEach((r) => { shelves[r.view.status] += 1; });
        return { bookmarks: lib.length, chaptersRead, comicsStarted, shelves };
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
        const ch = await this.db.chapter.findFirst({ where: { id: d.chapterId, comicId: d.comicId, comic: this.visibleComic, ...this.visibleChapter }, select: { id: true } });
        if (!ch)
            throw new common_1.BadRequestException("That chapter does not belong to this comic.");
        const data = { chapterId: d.chapterId, imageIndex: d.imageIndex, scrollY: d.scrollY };
        await this.db.readingHistory.upsert({ where: { userId_comicId: { userId, comicId: d.comicId } }, update: data, create: { userId, comicId: d.comicId, ...data } });
        await this.startedReading(userId, d.comicId);
    }
    async history(userId) {
        const rows = await this.db.readingHistory.findMany({ where: { userId, comic: this.visibleComic, chapter: { publishState: "PUBLISHED", deletedAt: null, OR: [{ sourceChapter: { is: null } }, { sourceChapter: { is: { sourceTitle: { state: "APPROVED" } } } }] } }, orderBy: { updatedAt: "desc" }, take: 50,
            include: { comic: { select: { id: true, slug: true, title: true } }, chapter: { select: { id: true, number: true, title: true, sourceChapter: { select: { numberLabel: true, title: true } } } } } });
        return rows.map((r) => {
            const { sourceChapter, ...chapter } = r.chapter;
            return { comic: r.comic, chapter: { ...chapter, displayNumber: (0, chapter_display_1.resolveChapterDisplayNumber)(chapter, sourceChapter) }, imageIndex: r.imageIndex, scrollY: r.scrollY, lastReadAt: r.updatedAt };
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
            this.db.bookmark.deleteMany({ where: { userId } }), this.db.readingHistory.deleteMany({ where: { userId } }), this.db.chapterRead.deleteMany({ where: { userId } }),
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
    __metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object, typeof (_b = typeof storage_service_1.StorageService !== "undefined" && storage_service_1.StorageService) === "function" ? _b : Object])
], UserService);
