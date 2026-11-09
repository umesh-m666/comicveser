import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { BookmarkQuery, ChangePasswordDto, ProgressDto, UpdateProfileDto } from "./dto/user.dto";

const comicBrief = {
  select: { id: true, slug: true, title: true, type: true, chapters: {
    where: { publishState: "PUBLISHED" as const, deletedAt: null }, orderBy: { number: "desc" as const }, take: 1,
    select: { id: true, number: true, publishedAt: true, sourceChapter: { select: { numberLabel: true } } } } },
};

@Injectable()
export class UserService {
  constructor(private db: PrismaService) {}

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

  async bookmarks(userId: string, q: BookmarkQuery) {
    const where = { userId, comic: { ...this.visibleComic, ...(q.q && { title: { contains: q.q, mode: "insensitive" as const } }) } };
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
    const ch = await this.db.chapter.findFirst({ where: { id: d.chapterId, comicId: d.comicId, publishState: "PUBLISHED", deletedAt: null, comic: this.visibleComic, OR: [{ sourceChapter: { is: null } }, { sourceChapter: { is: { sourceTitle: { state: "APPROVED" } } } }] }, select: { id: true } });
    if (!ch) throw new BadRequestException("That chapter does not belong to this comic.");
    const data = { chapterId: d.chapterId, imageIndex: d.imageIndex, scrollY: d.scrollY };
    await this.db.readingHistory.upsert({ where: { userId_comicId: { userId, comicId: d.comicId } }, update: data, create: { userId, comicId: d.comicId, ...data } });
  }

  async history(userId: string) {
    const rows = await this.db.readingHistory.findMany({ where: { userId, comic: this.visibleComic, chapter: { publishState: "PUBLISHED", deletedAt: null, OR: [{ sourceChapter: { is: null } }, { sourceChapter: { is: { sourceTitle: { state: "APPROVED" } } } }] } }, orderBy: { updatedAt: "desc" }, take: 50,
      include: { comic: { select: { id: true, slug: true, title: true } }, chapter: { select: { id: true, number: true, title: true, sourceChapter: { select: { numberLabel: true } } } } } });
    return rows.map((r) => {
      const { sourceChapter, ...chapter } = r.chapter;
      return { comic: r.comic, chapter: { ...chapter, displayNumber: sourceChapter ? sourceChapter.numberLabel ?? "Special" : String(chapter.number) }, imageIndex: r.imageIndex, scrollY: r.scrollY, lastReadAt: r.updatedAt };
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
      this.db.bookmark.deleteMany({ where: { userId } }), this.db.readingHistory.deleteMany({ where: { userId } }),
      this.db.notification.deleteMany({ where: { userId } }), this.db.reviewVote.deleteMany({ where: { userId } }),
      this.db.userProfile.deleteMany({ where: { userId } }),
      this.db.externalLibraryEntry.deleteMany({ where: { userId } }),
      this.db.review.updateMany({ where: { userId }, data: { deletedAt: new Date(), body: "[deleted]" } }),
      this.db.user.update({ where: { id: userId }, data: { deletedAt: new Date(), status: "SUSPENDED", email: `deleted-${userId}@deleted.invalid`, username: `deleted-${userId.slice(-10)}`, passwordHash: "!" } }),
      this.db.auditLog.create({ data: { actorId: userId, action: "user.delete_self", resource: "User", resourceId: userId } }),
    ]);
  }
}
