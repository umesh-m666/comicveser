import { resolveChapterDisplayNumber, resolveChapterPublishedAt } from "../sources/chapter-display";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { BookmarkQuery, ChangePasswordDto, ProgressDto, UpdateProfileDto } from "./dto/user.dto";
import { BOOKMARK_STATUSES, BookmarkStatusValue, effectiveStatus, normalizeSort, progressPercent, sortBookmarks } from "./bookmark-status";

@Injectable()
export class UserService {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private get visibleComic() {
    return {
      publishState: "PUBLISHED" as const,
      deletedAt: null,
      OR: this.db.publicComicOrFilter,
    };
  }

  async profile(id: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id }, include: { profile: true } });
    return { id: u.id, username: u.username, email: u.email, createdAt: u.createdAt, avatarUrl: u.profile?.avatarUrl ?? null, bio: u.profile?.bio ?? null };
  }

  async updateProfile(id: string, d: UpdateProfileDto) {
    await this.db.user.update({ where: { id }, data: {
      ...(d.username && { username: d.username }),
      profile: { upsert: { create: { bio: d.bio }, update: { ...(d.bio !== undefined && { bio: d.bio }) } } },
    } });
    return this.profile(id);
  }

  async changePassword(id: string, sessionId: string, d: ChangePasswordDto) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id } });
    if (!(await argon2.verify(u.passwordHash, d.current).catch(() => false))) throw new UnauthorizedException("Current password is incorrect.");
    const passwordHash = await argon2.hash(d.next, { type: argon2.argon2id });
    await this.db.$transaction([
      this.db.user.update({ where: { id }, data: { passwordHash } }),
      this.db.session.deleteMany({ where: { userId: id, NOT: { id: sessionId } } }), // keep this device signed in
    ]);
  }

  /** Chapters a reader may open: published, not deleted, and (for imported titles) from an approved source. */
  private get visibleChapter() {
    return { publishState: "PUBLISHED" as const, deletedAt: null, OR: [{ sourceChapter: { is: null } }, { sourceChapter: { is: { sourceTitle: { state: "APPROVED" as const } } } }] };
  }

  private async coverUrl(c: { externalCoverUrl: string | null; coverKey: string | null }) {
    return c.externalCoverUrl ?? (c.coverKey ? await this.storage.readUrl(c.coverKey) : null);
  }

  /** Every visible bookmark with its effective status and reading progress (a library is small, so this is done in one pass). */
  private async library(userId: string, search?: string) {
    const rows = await this.db.bookmark.findMany({
      where: { userId, comic: { AND: [this.visibleComic, ...(search ? [{ OR: [{ title: { contains: search, mode: "insensitive" as const } }, { altTitle: { contains: search, mode: "insensitive" as const } }] }] : [])] } },
      take: 1000,
      include: { comic: { select: { id: true, slug: true, title: true, type: true, status: true, coverKey: true, externalCoverUrl: true, chapters: {
        where: { publishState: "PUBLISHED" as const, deletedAt: null }, orderBy: { number: "desc" as const }, take: 1,
        select: { id: true, number: true, title: true, publishedAt: true, sourceChapter: { select: { numberLabel: true, title: true, publishedAt: true } } } } } } },
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
      const manual = (b.status as BookmarkStatusValue | null) ?? null;
      const status = effectiveStatus({ manual, readCount: read?.count ?? 0, hasHistory: !!hist, totalChapters: total, comicCompleted: b.comic.status === "COMPLETED" });
      const latest = b.comic.chapters[0];
      const latestLabel = latest ? resolveChapterDisplayNumber(latest, latest.sourceChapter) : null;
      const lastUpdatedAt = (latest ? resolveChapterPublishedAt(latest, latest.sourceChapter) : null) ?? b.updatedAt;
      const lastReadAt = hist?.updatedAt ?? read?.last ?? null;
      return {
        title: b.comic.title, bookmarkedAt: b.createdAt, lastUpdatedAt,
        view: {
          bookmarkedAt: b.createdAt, lastUpdatedAt, status, statusSource: manual ? ("manual" as const) : ("auto" as const),
          comic: {
            id: b.comic.id, slug: b.comic.slug, title: b.comic.title, type: b.comic.type, status: b.comic.status,
            coverUrl: await this.coverUrl(b.comic), totalChapters: total,
            latestChapter: latest ? { id: latest.id, number: latest.number, publishedAt: resolveChapterPublishedAt(latest, latest.sourceChapter), displayNumber: latestLabel } : null,
          },
          progress: {
            readCount: read?.count ?? 0, percent: progressPercent(read?.count ?? 0, total), lastReadAt,
            current: hist ? { chapterId: hist.chapter.id, number: hist.chapter.number, displayNumber: resolveChapterDisplayNumber(hist.chapter, hist.chapter.sourceChapter), imageIndex: hist.imageIndex } : null,
          },
        },
      };
    }));
  }

  async bookmarks(userId: string, q: BookmarkQuery) {
    const all = await this.library(userId, q.q?.trim() || undefined);
    const counts: Record<string, number> = { ALL: all.length };
    for (const s of BOOKMARK_STATUSES) counts[s] = 0;
    all.forEach((r) => { counts[r.view.status] += 1; });
    const wanted = q.status && q.status !== "ALL" ? q.status : null;
    const filtered = sortBookmarks(all.filter((r) => !wanted || r.view.status === wanted), normalizeSort(q.sort));
    const size = q.limit ?? 24;
    const items = filtered.slice((q.page - 1) * size, q.page * size).map((r) => r.view);
    return { total: filtered.length, page: q.page, pageSize: size, counts, items };
  }

  /** Sets a manual shelf, or AUTO to hand control back to reading progress. */
  async setBookmarkStatus(userId: string, comicId: string, status: string) {
    const value = status === "AUTO" ? null : (status as BookmarkStatusValue);
    const r = await this.db.bookmark.updateMany({ where: { userId, comicId }, data: { status: value } });
    if (r.count === 0) throw new NotFoundException("Bookmark not found.");
  }

  /** A reader who starts a comic on their Plan to Read shelf is now reading it. */
  private async startedReading(userId: string, comicId: string) {
    await this.db.bookmark.updateMany({ where: { userId, comicId, status: "PLAN_TO_READ" }, data: { status: null } });
  }

  async markChapterRead(userId: string, chapterId: string) {
    const ch = await this.db.chapter.findFirst({ where: { id: chapterId, ...this.visibleChapter, comic: this.visibleComic }, select: { id: true, comicId: true } });
    if (!ch) throw new NotFoundException("Chapter not found.");
    await this.db.chapterRead.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      update: { readAt: new Date() },
      create: { userId, comicId: ch.comicId, chapterId },
    });
    await this.startedReading(userId, ch.comicId);
  }

  async readChapterIds(userId: string, comicId: string) {
    const rows = await this.db.chapterRead.findMany({ where: { userId, comicId, chapter: this.visibleChapter }, select: { chapterId: true } });
    return { chapterIds: rows.map((r) => r.chapterId) };
  }

  /** Most recently finished chapters, for the account page. */
  async readChapters(userId: string) {
    const rows = await this.db.chapterRead.findMany({
      where: { userId, chapter: this.visibleChapter, comic: this.visibleComic }, orderBy: { readAt: "desc" }, take: 30,
      include: { comic: { select: { id: true, slug: true, title: true } }, chapter: { select: { id: true, number: true, title: true, sourceChapter: { select: { numberLabel: true, title: true } } } } },
    });
    return rows.map((r) => ({ comic: r.comic, readAt: r.readAt,
      chapter: { id: r.chapter.id, number: r.chapter.number, displayNumber: resolveChapterDisplayNumber(r.chapter, r.chapter.sourceChapter) } }));
  }

  async stats(userId: string) {
    const [lib, chaptersRead, comicsStarted] = await Promise.all([
      this.library(userId),
      this.db.chapterRead.count({ where: { userId, chapter: this.visibleChapter, comic: this.visibleComic } }),
      this.db.readingHistory.count({ where: { userId, comic: this.visibleComic } }),
    ]);
    const shelves: Record<string, number> = {};
    for (const s of BOOKMARK_STATUSES) shelves[s] = 0;
    lib.forEach((r) => { shelves[r.view.status] += 1; });
    return { bookmarks: lib.length, chaptersRead, comicsStarted, shelves };
  }

  async isBookmarked(userId: string, comicId: string) {
    return { bookmarked: !!(await this.db.bookmark.findFirst({ where: { userId, comicId, comic: this.visibleComic }, select: { id: true } })) };
  }
  async addBookmark(userId: string, comicId: string) {
    const c = await this.db.comic.findFirst({ where: { id: comicId, ...this.visibleComic }, select: { id: true } });
    if (!c) throw new NotFoundException("Comic not found.");
    await this.db.bookmark.upsert({ where: { userId_comicId: { userId, comicId } }, update: {}, create: { userId, comicId } }); // idempotent; DB unique prevents duplicates
  }
  async removeBookmark(userId: string, comicId: string) { await this.db.bookmark.deleteMany({ where: { userId, comicId } }); }

  async saveProgress(userId: string, d: ProgressDto) {
    const ch = await this.db.chapter.findFirst({ where: { id: d.chapterId, comicId: d.comicId, comic: this.visibleComic, ...this.visibleChapter }, select: { id: true } });
    if (!ch) throw new BadRequestException("That chapter does not belong to this comic.");
    const data = { chapterId: d.chapterId, imageIndex: d.imageIndex, scrollY: d.scrollY };
    await this.db.readingHistory.upsert({ where: { userId_comicId: { userId, comicId: d.comicId } }, update: data, create: { userId, comicId: d.comicId, ...data } });
    await this.startedReading(userId, d.comicId);
  }

  async history(userId: string) {
    const rows = await this.db.readingHistory.findMany({ where: { userId, comic: this.visibleComic, chapter: { publishState: "PUBLISHED", deletedAt: null, OR: [{ sourceChapter: { is: null } }, { sourceChapter: { is: { sourceTitle: { state: "APPROVED" } } } }] } }, orderBy: { updatedAt: "desc" }, take: 50,
      include: { comic: { select: { id: true, slug: true, title: true } }, chapter: { select: { id: true, number: true, title: true, sourceChapter: { select: { numberLabel: true, title: true } } } } } });
    return rows.map((r) => {
      const { sourceChapter, ...chapter } = r.chapter;
      return { comic: r.comic, chapter: { ...chapter, displayNumber: resolveChapterDisplayNumber(chapter, sourceChapter) }, imageIndex: r.imageIndex, scrollY: r.scrollY, lastReadAt: r.updatedAt };
    });
  }

  async reviews(userId: string) {
    const rows = await this.db.review.findMany({ where: { userId, deletedAt: null, comic: this.visibleComic }, orderBy: { createdAt: "desc" }, take: 100, include: { comic: { select: { slug: true, title: true } } } });
    const ratings = await this.db.rating.findMany({ where: { userId, comicId: { in: rows.map((r) => r.comicId) } }, select: { comicId: true, value: true } });
    const rm = new Map(ratings.map((r) => [r.comicId, r.value]));
    return rows.map((r) => ({ id: r.id, body: r.body, helpfulCount: r.helpfulCount, createdAt: r.createdAt, comic: r.comic, rating: rm.get(r.comicId) ?? null }));
  }

  /** Removes personal data and signs the user out everywhere. The row stays (anonymised) so payment records and ratings keep working. */
  async deleteAccount(userId: string, password: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });
    if (u.role.name === "ADMIN") throw new ForbiddenException("Admin accounts can't be deleted here.");
    if (!(await argon2.verify(u.passwordHash, password).catch(() => false))) throw new UnauthorizedException("Password is incorrect.");
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
}
