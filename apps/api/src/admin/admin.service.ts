import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import * as yauzl from "yauzl";
import { PrismaService } from "../prisma/prisma.service";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, StorageService } from "../storage/storage.service";
import { dimensions, sniff } from "../storage/image";
import { AdminListQuery, AnnouncementDto } from "./dto/admin.dto";

const SIZE = 20;
const MAX_ZIP_BYTES = 100 * 1024 * 1024, MAX_ENTRIES = 300, MAX_TOTAL = 400 * 1024 * 1024;
const pg = (page: number) => ({ skip: (page - 1) * SIZE, take: SIZE });
const bad = (m: string) => new BadRequestException(m);

// Reads a ZIP entirely in memory (nothing is written to disk), rejecting unsafe or oversized content.
function readZip(buf: Buffer): Promise<{ name: string; data: Buffer }[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) return reject(bad("That file is not a valid ZIP archive."));
      const out: { name: string; data: Buffer }[] = []; let total = 0, fileCount = 0;
      zip.on("error", () => reject(bad("The ZIP archive is corrupt or could not be read.")));
      zip.on("end", () => resolve(out));
      zip.on("entry", (e: yauzl.Entry) => {
        const name = e.fileName, base = name.split("/").pop() ?? "";
        // Directory entries and common OS metadata should not count toward the image limit.
        if (name.endsWith("/") || name.startsWith("__MACOSX/") || base.startsWith(".")) return zip.readEntry();
        fileCount++;
        if (fileCount > MAX_ENTRIES) return reject(bad(`Archive has more than ${MAX_ENTRIES} image files.`));
        if (name.includes("..") || name.startsWith("/") || name.includes("\\") || /^[a-zA-Z]:/.test(name)) return reject(bad("Archive contains unsafe file paths."));
        if (e.uncompressedSize > MAX_IMAGE_BYTES) return reject(bad(`"${base}" is larger than 10 MB.`));
        total += e.uncompressedSize;
        if (total > MAX_TOTAL) return reject(bad("Archive is too large once extracted."));
        zip.openReadStream(e, (err2, stream) => {
          if (err2 || !stream) return reject(bad(`Could not read "${base}".`));
          const chunks: Buffer[] = [];
          stream.on("data", (c: Buffer) => chunks.push(c));
          stream.on("error", () => reject(bad(`Could not read "${base}".`)));
          stream.on("end", () => { out.push({ name, data: Buffer.concat(chunks) }); zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}

@Injectable()
export class AdminService {
  constructor(private db: PrismaService, private storage: StorageService) {}

  async dashboard() {
    const since = new Date(Date.now() - 30 * 864e5);
    const [users, active, comics, chapters, published, reading, reports, popular, latest] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null } }),
      this.db.session.groupBy({ by: ["userId"], where: { createdAt: { gte: since } } }),
      this.db.comic.count({ where: { deletedAt: null } }),
      this.db.chapter.count({ where: { deletedAt: null } }),
      this.db.chapter.count({ where: { deletedAt: null, publishState: "PUBLISHED" } }),
      this.db.readingHistory.count(),
      this.db.report.count({ where: { status: "OPEN" } }),
      this.db.comic.findMany({ where: { deletedAt: null }, orderBy: { views: "desc" }, take: 5, select: { id: true, title: true, views: true } }),
      this.db.chapter.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, number: true, publishState: true, createdAt: true, comic: { select: { title: true } } } }),
    ]);
    return { totals: { users, activeUsers30d: active.length, comics, chapters, publishedChapters: published, readingRecords: reading, pendingReports: reports }, popular, latest };
  }

  async comics(q: AdminListQuery) {
    const where: Prisma.ComicWhereInput = {
      deletedAt: null,
      ...(q.state ? { publishState: q.state } : { publishState: { not: "ARCHIVED" } }),
      ...(q.q && { title: { contains: q.q, mode: "insensitive" } }),
    };
    const [total, rawItems] = await Promise.all([
      this.db.comic.count({ where }),
      this.db.comic.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        ...pg(q.page),
        include: { _count: { select: { chapters: { where: { deletedAt: null } } } } },
      }),
    ]);
    const seen = new Set<string>();
    const items = rawItems.filter((c) => {
      const k = c.title.trim().toLowerCase().replace(/^official\s+/i, "").replace(/[^a-z0-9]+/g, "") || c.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const adjustedTotal = Math.max(items.length, total - (rawItems.length - items.length));
    return { items, total: adjustedTotal, page: q.page, pages: Math.max(1, Math.ceil(adjustedTotal / SIZE)) };
  }

  async comic(id: string) {
    const c = await this.db.comic.findFirst({ where: { id, deletedAt: null }, include: { genres: { include: { genre: true } } } });
    if (!c) throw new NotFoundException("Comic not found.");
    const { genres, ...rest } = c;
    return { ...rest, genreSlugs: genres.map((g) => g.genre.slug) };
  }

  chapters(comicId?: string) {
    if (!comicId) throw bad("comicId is required.");
    return this.db.chapter.findMany({
      where: { comicId, deletedAt: null },
      orderBy: { number: "desc" },
      include: {
        _count: { select: { images: true } },
        comic: { select: { slug: true } },
        sourceChapter: {
          include: {
            sourceTitle: { select: { sourceId: true, externalId: true } },
          },
        },
      },
    });
  }

  async chapter(id: string) {
    const ch = await this.db.chapter.findFirst({ where: { id, deletedAt: null }, include: { comic: { select: { id: true, title: true, slug: true } }, images: { orderBy: { position: "asc" } } } });
    if (!ch) throw new NotFoundException("Chapter not found.");
    const images = await Promise.all(ch.images.map(async (i) => ({ id: i.id, position: i.position, width: i.width, height: i.height, url: await this.storage.readUrl(i.storageKey) })));
    return { ...ch, images };
  }

  async deleteImage(chapterId: string, imageId: string, actorId: string) {
    const img = await this.db.chapterImage.findFirst({ where: { id: imageId, chapterId } });
    if (!img) throw new NotFoundException("Image not found.");
    await this.db.$transaction([
      this.db.chapterImage.delete({ where: { id: imageId } }),
      this.db.auditLog.create({ data: { actorId, action: "chapter.image.delete", resource: "Chapter", resourceId: chapterId } }),
    ]);
    await this.storage.remove(img.storageKey);
  }

  /** Bulk upload. Adds images to the chapter as-is; publishing stays a separate, explicit step. */
  async bulkZip(chapterId: string, file: { buffer: Buffer; size: number } | undefined, actorId: string) {
    if (!file) throw bad("Attach a ZIP file in the 'file' field.");
    if (file.size > MAX_ZIP_BYTES) throw bad("ZIP is larger than 100 MB.");
    if (!(await this.db.chapter.findFirst({ where: { id: chapterId, deletedAt: null }, select: { id: true } }))) throw new NotFoundException("Chapter not found.");
    const entries = (await readZip(file.buffer)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!entries.length) throw bad("The archive contains no files.");

    const prepared = entries.map((e) => {
      const base = e.name.split("/").pop()!;
      const mime = sniff(e.data);
      if (!mime || !IMAGE_TYPES[mime]) throw bad(`"${base}" is not a supported image (JPEG, PNG or WebP).`);
      const dim = dimensions(e.data, mime);
      if (!dim) throw bad(`"${base}" could not be read. AVIF is not accepted in ZIP uploads; use JPEG, PNG or WebP.`);
      return { data: e.data, mime, ...dim, sha256: createHash("sha256").update(e.data).digest("hex"), key: `chapters/${chapterId}/${randomUUID()}.${IMAGE_TYPES[mime]}` };
    });
    if (new Set(prepared.map((p) => p.sha256)).size !== prepared.length) throw new ConflictException("The archive contains duplicate images.");

    const uploaded: string[] = [];
    try {
      for (const p of prepared) { await this.storage.put(p.key, p.data, p.mime); uploaded.push(p.key); }
      return await this.db.$transaction(async (tx) => {
        let pos = ((await tx.chapterImage.aggregate({ where: { chapterId }, _max: { position: true } }))._max.position ?? -1) + 1;
        for (const p of prepared) await tx.chapterImage.create({ data: { chapterId, position: pos++, storageKey: p.key, width: p.width, height: p.height, sha256: p.sha256 } });
        await tx.auditLog.create({ data: { actorId, action: "chapter.bulk_upload", resource: "Chapter", resourceId: chapterId, meta: { count: prepared.length } } });
        return { added: prepared.length };
      });
    } catch (e) {
      await Promise.all(uploaded.map((k) => this.storage.remove(k)));
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ConflictException("One of these images is already in this chapter.");
      throw e;
    }
  }

  async users(q: AdminListQuery) {
    const where: Prisma.UserWhereInput = { deletedAt: null, ...(q.q && { OR: [{ username: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }] }) };
    const [total, rows] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({ where, orderBy: { createdAt: "desc" }, ...pg(q.page), select: { id: true, username: true, email: true, status: true, emailVerifiedAt: true, createdAt: true, role: { select: { name: true } } } }),
    ]);
    return { items: rows.map(({ role, ...u }) => ({ ...u, role: role.name })), total, page: q.page, pages: Math.max(1, Math.ceil(total / SIZE)) };
  }

  async setUserStatus(id: string, status: UserStatus, actorId: string) {
    if (id === actorId) throw new ForbiddenException("You can't change your own account status.");
    await this.db.$transaction(async (tx) => {
      const r = await tx.user.updateMany({ where: { id, deletedAt: null }, data: { status } });
      if (!r.count) throw new NotFoundException("User not found.");
      if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId: id } }); // sign out immediately
      await tx.auditLog.create({ data: { actorId, action: status === "SUSPENDED" ? "user.suspend" : "user.restore", resource: "User", resourceId: id } });
    });
  }

  async reports(page: number) {
    const [total, items] = await Promise.all([this.db.report.count(), this.db.report.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], ...pg(page) })]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / SIZE)) };
  }
  async resolveReport(id: string, status: "RESOLVED" | "DISMISSED", actorId: string) {
    await this.db.$transaction(async (tx) => {
      const r = await tx.report.updateMany({ where: { id }, data: { status, resolvedAt: new Date() } });
      if (!r.count) throw new NotFoundException("Report not found.");
      await tx.auditLog.create({ data: { actorId, action: `report.${status.toLowerCase()}`, resource: "Report", resourceId: id } });
    });
  }

  async auditLogs(page: number) {
    const [total, items] = await Promise.all([
      this.db.auditLog.count(),
      this.db.auditLog.findMany({ orderBy: { createdAt: "desc" }, ...pg(page), include: { actor: { select: { username: true } } } }),
    ]);
    return { items: items.map(({ actor, ...l }) => ({ ...l, actor: actor?.username ?? l.actorLabel ?? "system" })), total, page, pages: Math.max(1, Math.ceil(total / SIZE)) };
  }

  async creators() {
    return this.db.creator.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { user: { select: { username: true, email: true } }, _count: { select: { comics: true } } } });
  }
  async setCreatorStatus(id: string, status: "APPROVED" | "REJECTED" | "SUSPENDED", actorId: string) {
    await this.db.$transaction(async (tx) => {
      const c = await tx.creator.findUnique({ where: { id }, include: { user: { include: { role: true } } } });
      if (!c) throw new NotFoundException("Creator not found.");
      await tx.creator.update({ where: { id }, data: { status } });
      const creatorRole = await tx.role.upsert({ where: { name: "CREATOR" }, update: {}, create: { name: "CREATOR" } });
      const userRole = await tx.role.upsert({ where: { name: "USER" }, update: {}, create: { name: "USER" } });
      if (status === "APPROVED" && c.user.role.name === "USER") await tx.user.update({ where: { id: c.userId }, data: { roleId: creatorRole.id } });
      if (status !== "APPROVED" && c.user.role.name === "CREATOR") await tx.user.update({ where: { id: c.userId }, data: { roleId: userRole.id } });
      await tx.notification.create({ data: { userId: c.userId, type: "ACCOUNT", title: "Creator application update", body: `Your creator account is now ${status.toLowerCase()}.`, href: "/creator/dashboard" } });
      await tx.auditLog.create({ data: { actorId, action: `creator.${status.toLowerCase()}`, resource: "Creator", resourceId: id } });
    });
  }
  async reviews(page: number) {
    const where = { deletedAt: null };
    const [total, rows] = await Promise.all([this.db.review.count({ where }), this.db.review.findMany({ where, orderBy: { createdAt: "desc" }, ...pg(page), include: { user: { select: { username: true } }, comic: { select: { title: true } } } })]);
    return { items: rows, total, page, pages: Math.max(1, Math.ceil(total / SIZE)) };
  }

  announcements() { return this.db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 }); }
  publicAnnouncements() {
    return this.db.announcement.findMany({ where: { OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, body: true, createdAt: true } });
  }
  async createAnnouncement(d: AnnouncementDto, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const a = await tx.announcement.create({ data: { title: d.title, body: d.body, publishAt: d.publishAt ? new Date(d.publishAt) : null, publishedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: "announcement.create", resource: "Announcement", resourceId: a.id } });
      return a;
    });
  }
  async deleteAnnouncement(id: string, actorId: string) {
    await this.db.$transaction(async (tx) => {
      const r = await tx.announcement.deleteMany({ where: { id } });
      if (!r.count) throw new NotFoundException("Announcement not found.");
      await tx.auditLog.create({ data: { actorId, action: "announcement.delete", resource: "Announcement", resourceId: id } });
    });
  }
}
