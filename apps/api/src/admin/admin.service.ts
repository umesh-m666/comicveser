import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import * as yauzl from "yauzl";
import { PrismaService } from "../prisma/prisma.service";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, StorageService } from "../storage/storage.service";
import { dimensions, sniff } from "../storage/image";
import { AdminListQuery, AnnouncementDto, ResolveReportDto } from "./dto/admin.dto";
import { SourcesService } from "../sources/sources.service";
import { AuthService } from "../auth/auth.service";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { primaryWebOrigin } from "../common/config";

const SIZE = 20;
const MAX_ZIP_BYTES = 100 * 1024 * 1024,
  MAX_ENTRIES = 300,
  MAX_TOTAL = 400 * 1024 * 1024;
const pg = (page: number) => ({ skip: (page - 1) * SIZE, take: SIZE });
const bad = (m: string) => new BadRequestException(m);

function readZip(buf: Buffer): Promise<{ name: string; data: Buffer }[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) return reject(bad("That file is not a valid ZIP archive."));
      const out: { name: string; data: Buffer }[] = [];
      let total = 0,
        fileCount = 0;
      zip.on("error", () => reject(bad("The ZIP archive is corrupt or could not be read.")));
      zip.on("end", () => resolve(out));
      zip.on("entry", (e: yauzl.Entry) => {
        const name = e.fileName,
          base = name.split("/").pop() ?? "";
        if (name.endsWith("/") || name.startsWith("__MACOSX/") || base.startsWith(".")) return zip.readEntry();
        fileCount++;
        if (fileCount > MAX_ENTRIES) return reject(bad(`Archive has more than ${MAX_ENTRIES} image files.`));
        if (name.includes("..") || name.startsWith("/") || name.includes("\\") || /^[a-zA-Z]:/.test(name))
          return reject(bad("Archive contains unsafe file paths."));
        if (e.uncompressedSize > MAX_IMAGE_BYTES) return reject(bad(`"${base}" is larger than 10 MB.`));
        total += e.uncompressedSize;
        if (total > MAX_TOTAL) return reject(bad("Archive is too large once extracted."));
        zip.openReadStream(e, (err2, stream) => {
          if (err2 || !stream) return reject(bad(`Could not read "${base}".`));
          const chunks: Buffer[] = [];
          stream.on("data", (c: Buffer) => chunks.push(c));
          stream.on("error", () => reject(bad(`Could not read "${base}".`)));
          stream.on("end", () => {
            out.push({ name, data: Buffer.concat(chunks) });
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

@Injectable()
export class AdminService {
  private readonly log = new Logger("Admin");

  constructor(
    private db: PrismaService,
    private storage: StorageService,
    @Optional() private sources?: SourcesService,
    @Optional() private auth?: AuthService,
    @Optional() private mail?: MailService,
    @Optional() private notif?: NotificationsService,
  ) {}

  private formatReportRow(r: any) {
    const category = r.category ?? (r.targetType === "chapter" ? "BROKEN_CHAPTER" : "GENERAL");
    const subject = r.subject || r.reason?.slice(0, 80) || "User Issue Report";
    const description = r.description || r.reason || "";
    return {
      id: r.id,
      reporterId: r.reporterId,
      username: r.reporter?.username ?? "user",
      email: r.reporter?.email ?? "",
      reporter: r.reporter ?? null,
      targetType: r.targetType,
      targetId: r.targetId,
      category,
      subject,
      description,
      reason: r.reason,
      comicId: r.comicId ?? null,
      chapterId: r.chapterId ?? null,
      status: r.status,
      isRead: Boolean(r.isRead),
      adminResponse: r.adminResponse ?? null,
      respondedAt: r.respondedAt ?? null,
      respondedById: r.respondedById ?? null,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt ?? null,
    };
  }

  async dashboard() {
    const since = new Date(Date.now() - 30 * 864e5);
    const [
      users,
      active,
      comics,
      chapters,
      published,
      reading,
      openReports,
      resolvedReports,
      dismissedReports,
      popular,
      latest,
      recentReportsRaw,
    ] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null } }),
      this.db.session.groupBy({ by: ["userId"], where: { createdAt: { gte: since } } }),
      this.db.comic.count({ where: { deletedAt: null } }),
      this.db.chapter.count({ where: { deletedAt: null } }),
      this.db.chapter.count({ where: { deletedAt: null, publishState: "PUBLISHED" } }),
      this.db.readingHistory.count(),
      this.db.report.count({ where: { status: "OPEN" } }),
      this.db.report.count({ where: { status: "RESOLVED" } }),
      this.db.report.count({ where: { status: "DISMISSED" } }),
      this.db.comic.findMany({
        where: { deletedAt: null },
        orderBy: { views: "desc" },
        take: 5,
        select: { id: true, title: true, views: true },
      }),
      this.db.chapter.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          number: true,
          publishState: true,
          createdAt: true,
          comic: { select: { title: true } },
        },
      }),
      this.db.report
        .findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { reporter: { select: { id: true, username: true, email: true } } },
        })
        .catch(() =>
          this.db.report.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
        ),
    ]);

    const recentReports = (recentReportsRaw ?? []).map((r: any) => this.formatReportRow(r));
    let unreadReports = recentReports.filter((r) => !r.isRead && r.status === "OPEN").length;
    try {
      unreadReports = await (this.db.report as any).count({ where: { isRead: false } });
    } catch {
      // Fallback to computed unread count
    }

    const publishingErrors = this.sources?.getRecentPublishErrors() ?? [];
    const providerFailures = this.sources?.getRecentProviderErrors() ?? [];
    const authFailures = this.auth?.getRecentAuthFailures() ?? [];
    const mailFailures = this.mail?.getRecentFailures() ?? [];
    const mailStatus = this.mail?.getConfigStatus() ?? {
      provider: process.env.MAIL_PROVIDER ?? "log",
      configured: false,
      issues: [],
    };
    const authConfig = this.auth?.getAuthConfig() ?? {
      googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null,
    };

    return {
      totals: {
        users,
        activeUsers30d: active.length,
        comics,
        chapters,
        publishedChapters: published,
        readingRecords: reading,
        pendingReports: openReports,
        unreadReports,
        resolvedReports,
        dismissedReports,
      },
      popular,
      latest,
      issueReports: {
        total: openReports + resolvedReports + dismissedReports,
        open: openReports,
        unread: unreadReports,
        resolved: resolvedReports,
        dismissed: dismissedReports,
        recent: recentReports,
      },
      operationalAlerts: {
        publishingErrors,
        providerFailures,
        authFailures,
        mailFailures,
        mailStatus,
        authConfig,
      },
    };
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
    const c = await this.db.comic.findFirst({
      where: { id, deletedAt: null },
      include: { genres: { include: { genre: true } } },
    });
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
    const ch = await this.db.chapter.findFirst({
      where: { id, deletedAt: null },
      include: {
        comic: { select: { id: true, title: true, slug: true } },
        images: { orderBy: { position: "asc" } },
      },
    });
    if (!ch) throw new NotFoundException("Chapter not found.");
    const images = await Promise.all(
      ch.images.map(async (i) => ({
        id: i.id,
        position: i.position,
        width: i.width,
        height: i.height,
        url: await this.storage.readUrl(i.storageKey),
      })),
    );
    return { ...ch, images };
  }

  async deleteImage(chapterId: string, imageId: string, actorId: string) {
    const img = await this.db.chapterImage.findFirst({ where: { id: imageId, chapterId } });
    if (!img) throw new NotFoundException("Image not found.");
    await this.db.$transaction([
      this.db.chapterImage.delete({ where: { id: imageId } }),
      this.db.auditLog.create({
        data: { actorId, action: "chapter.image.delete", resource: "Chapter", resourceId: chapterId },
      }),
    ]);
    await this.storage.remove(img.storageKey);
  }

  async bulkZip(chapterId: string, file: { buffer: Buffer; size: number } | undefined, actorId: string) {
    if (!file) throw bad("Attach a ZIP file in the 'file' field.");
    if (file.size > MAX_ZIP_BYTES) throw bad("ZIP is larger than 100 MB.");
    if (!(await this.db.chapter.findFirst({ where: { id: chapterId, deletedAt: null }, select: { id: true } })))
      throw new NotFoundException("Chapter not found.");
    const entries = (await readZip(file.buffer)).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    if (!entries.length) throw bad("The archive contains no files.");

    const prepared = entries.map((e) => {
      const base = e.name.split("/").pop()!;
      const mime = sniff(e.data);
      if (!mime || !IMAGE_TYPES[mime]) throw bad(`"${base}" is not a supported image (JPEG, PNG or WebP).`);
      const dim = dimensions(e.data, mime);
      if (!dim) throw bad(`"${base}" could not be read. AVIF is not accepted in ZIP uploads; use JPEG, PNG or WebP.`);
      return {
        data: e.data,
        mime,
        ...dim,
        sha256: createHash("sha256").update(e.data).digest("hex"),
        key: `chapters/${chapterId}/${randomUUID()}.${IMAGE_TYPES[mime]}`,
      };
    });
    if (new Set(prepared.map((p) => p.sha256)).size !== prepared.length)
      throw new ConflictException("The archive contains duplicate images.");

    const uploaded: string[] = [];
    try {
      for (const p of prepared) {
        await this.storage.put(p.key, p.data, p.mime);
        uploaded.push(p.key);
      }
      return await this.db.$transaction(async (tx) => {
        let pos = ((await tx.chapterImage.aggregate({ where: { chapterId }, _max: { position: true } }))._max.position ?? -1) + 1;
        for (const p of prepared)
          await tx.chapterImage.create({
            data: {
              chapterId,
              position: pos++,
              storageKey: p.key,
              width: p.width,
              height: p.height,
              sha256: p.sha256,
            },
          });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "chapter.bulk_upload",
            resource: "Chapter",
            resourceId: chapterId,
            meta: { count: prepared.length },
          },
        });
        return { added: prepared.length };
      });
    } catch (e) {
      await Promise.all(uploaded.map((k) => this.storage.remove(k)));
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictException("One of these images is already in this chapter.");
      throw e;
    }
  }

  async users(q: AdminListQuery) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.q && {
        OR: [
          { username: { contains: q.q, mode: "insensitive" } },
          { email: { contains: q.q, mode: "insensitive" } },
        ],
      }),
    };
    const [total, rows] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...pg(q.page),
        select: {
          id: true,
          username: true,
          email: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
          role: { select: { name: true } },
          profile: { select: { avatarUrl: true } },
        },
      }),
    ]);
    return {
      items: rows.map(({ role, profile, ...u }) => ({
        ...u,
        role: role.name,
        avatarUrl: profile?.avatarUrl ?? null,
      })),
      total,
      page: q.page,
      pages: Math.max(1, Math.ceil(total / SIZE)),
    };
  }

  async setUserStatus(id: string, status: UserStatus, actorId: string) {
    if (id === actorId) throw new ForbiddenException("You can't change your own account status.");
    await this.db.$transaction(async (tx) => {
      const r = await tx.user.updateMany({ where: { id, deletedAt: null }, data: { status } });
      if (!r.count) throw new NotFoundException("User not found.");
      if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: status === "SUSPENDED" ? "user.suspend" : "user.restore",
          resource: "User",
          resourceId: id,
        },
      });
    });
  }

  async reports(queryOrPage: number | AdminListQuery = 1) {
    const q: AdminListQuery =
      typeof queryOrPage === "number" ? { page: queryOrPage } : { ...queryOrPage, page: queryOrPage.page ?? 1 };
    const page = Math.max(1, q.page ?? 1);

    // Fetch with reporter details
    const allMatchingRaw = await this.db.report
      .findMany({
        where: q.reportStatus ? { status: q.reportStatus } : undefined,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { reporter: { select: { id: true, username: true, email: true } } },
      })
      .catch(() =>
        this.db.report.findMany({
          where: q.reportStatus ? { status: q.reportStatus } : undefined,
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
      );

    const formatted = (allMatchingRaw ?? []).map((r: any) => this.formatReportRow(r));
    const search = q.q?.trim().toLowerCase() ?? "";
    const catFilter = q.category?.trim().toUpperCase() ?? "";
    const unreadOnly = q.unreadOnly === "true" || q.unreadOnly === "1";

    const filtered = formatted.filter((item) => {
      if (catFilter && item.category.toUpperCase() !== catFilter) return false;
      if (unreadOnly && item.isRead) return false;
      if (search) {
        const hay = [
          item.id,
          item.username,
          item.email,
          item.category,
          item.subject,
          item.description,
          item.reason,
          item.targetType,
          item.targetId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const items = filtered.slice((page - 1) * SIZE, page * SIZE);

    const [openCount, resolvedCount, dismissedCount] = await Promise.all([
      this.db.report.count({ where: { status: "OPEN" } }),
      this.db.report.count({ where: { status: "RESOLVED" } }),
      this.db.report.count({ where: { status: "DISMISSED" } }),
    ]);
    const unreadCount = formatted.filter((r) => !r.isRead).length;

    return {
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / SIZE)),
      summary: {
        total: openCount + resolvedCount + dismissedCount,
        open: openCount,
        resolved: resolvedCount,
        dismissed: dismissedCount,
        unread: unreadCount,
      },
    };
  }

  async resolveReport(
    id: string,
    dtoOrStatus: "OPEN" | "RESOLVED" | "DISMISSED" | ResolveReportDto,
    actorId: string,
  ) {
    const dto: ResolveReportDto =
      typeof dtoOrStatus === "string" ? { status: dtoOrStatus } : dtoOrStatus;
    const status = dto.status;
    const adminResponse = dto.adminResponse?.trim() || undefined;
    const now = new Date();

    const existing = await this.db.report
      .findUnique({
        where: { id },
        include: { reporter: { select: { id: true, username: true, email: true } } },
      })
      .catch(() => this.db.report.findUnique({ where: { id } }));

    if (!existing) throw new NotFoundException("Report not found.");

    await this.db.$transaction(async (tx) => {
      try {
        await (tx.report as any).update({
          where: { id },
          data: {
            status,
            resolvedAt: status === "OPEN" ? null : now,
            isRead: dto.isRead ?? true,
            ...(adminResponse !== undefined
              ? {
                  adminResponse,
                  respondedAt: now,
                  respondedById: actorId,
                }
              : {}),
          },
        });
      } catch {
        await tx.report.updateMany({
          where: { id },
          data: { status, resolvedAt: status === "OPEN" ? null : now },
        });
        try {
          if (adminResponse !== undefined) {
            await this.db.$executeRawUnsafe(
              `UPDATE "Report" SET "isRead" = true, "adminResponse" = $1, "respondedAt" = NOW(), "respondedById" = $2 WHERE "id" = $3`,
              adminResponse,
              actorId,
              id,
            );
          } else {
            await this.db.$executeRawUnsafe(
              `UPDATE "Report" SET "isRead" = true WHERE "id" = $1`,
              id,
            );
          }
        } catch {
          // Ignore in mock environment
        }
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: `report.${status.toLowerCase()}`,
          resource: "Report",
          resourceId: id,
          meta: adminResponse ? { hasResponse: true } : undefined,
        },
      });
    });

    // Notify the reporting user when an admin responds or resolves their issue report
    const reporterId = existing.reporterId;
    const reporter = (existing as any).reporter;
    const subjectText = (existing as any).subject || existing.reason?.slice(0, 60) || "your issue report";

    if (reporterId) {
      const notifTitle =
        adminResponse
          ? `Admin responded to your report: ${subjectText}`
          : `Your issue report was marked ${status.toLowerCase()}`;
      const notifBody = adminResponse
        ? `Response from Admin: ${adminResponse}`
        : `Status for "${subjectText}" is now ${status}.`;
      try {
        if (this.notif) {
          await this.notif.push(reporterId, "ACCOUNT", notifTitle, notifBody, "/profile/notifications");
        } else {
          await this.db.notification.create({
            data: {
              userId: reporterId,
              type: "ACCOUNT",
              title: notifTitle.slice(0, 200),
              body: notifBody.slice(0, 1000),
              href: "/profile/notifications",
            },
          });
        }
      } catch (err) {
        this.log.warn(`Could not create report resolution notification: ${(err as Error).message}`);
      }

      if (adminResponse && reporter?.email && this.mail) {
        void this.mail
          .sendAccountNoticeEmail(
            reporter.email,
            reporter.username || "Reader",
            notifTitle,
            `Status: ${status}\n\nAdmin Response:\n${adminResponse}`,
            `${primaryWebOrigin()}/profile/notifications`,
          )
          .catch(() => undefined);
      }
    }

    return { ok: true, id, status, adminResponse: adminResponse ?? null };
  }

  async auditLogs(page: number) {
    const [total, items] = await Promise.all([
      this.db.auditLog.count(),
      this.db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        ...pg(page),
        include: { actor: { select: { username: true } } },
      }),
    ]);
    return {
      items: items.map(({ actor, ...l }) => ({
        ...l,
        actor: actor?.username ?? l.actorLabel ?? "system",
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / SIZE)),
    };
  }

  async creators() {
    return this.db.creator.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { username: true, email: true } },
        _count: { select: { comics: true } },
      },
    });
  }

  async setCreatorStatus(id: string, status: "APPROVED" | "REJECTED" | "SUSPENDED", actorId: string) {
    await this.db.$transaction(async (tx) => {
      const c = await tx.creator.findUnique({
        where: { id },
        include: { user: { include: { role: true } } },
      });
      if (!c) throw new NotFoundException("Creator not found.");
      await tx.creator.update({ where: { id }, data: { status } });
      const creatorRole = await tx.role.upsert({
        where: { name: "CREATOR" },
        update: {},
        create: { name: "CREATOR" },
      });
      const userRole = await tx.role.upsert({
        where: { name: "USER" },
        update: {},
        create: { name: "USER" },
      });
      if (status === "APPROVED" && c.user.role.name === "USER")
        await tx.user.update({ where: { id: c.userId }, data: { roleId: creatorRole.id } });
      if (status !== "APPROVED" && c.user.role.name === "CREATOR")
        await tx.user.update({ where: { id: c.userId }, data: { roleId: userRole.id } });
      await tx.notification.create({
        data: {
          userId: c.userId,
          type: "ACCOUNT",
          title: "Creator application update",
          body: `Your creator account is now ${status.toLowerCase()}.`,
          href: "/creator/dashboard",
        },
      });
      await tx.auditLog.create({
        data: { actorId, action: `creator.${status.toLowerCase()}`, resource: "Creator", resourceId: id },
      });
    });
  }

  async reviews(page: number) {
    const where = { deletedAt: null };
    const [total, rows] = await Promise.all([
      this.db.review.count({ where }),
      this.db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...pg(page),
        include: { user: { select: { username: true } }, comic: { select: { title: true } } },
      }),
    ]);
    return { items: rows, total, page, pages: Math.max(1, Math.ceil(total / SIZE)) };
  }

  announcements() {
    return this.db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  }

  publicAnnouncements() {
    return this.db.announcement.findMany({
      where: { OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, body: true, createdAt: true },
    });
  }

  async createAnnouncement(d: AnnouncementDto, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const a = await tx.announcement.create({
        data: {
          title: d.title,
          body: d.body,
          publishAt: d.publishAt ? new Date(d.publishAt) : null,
          publishedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: { actorId, action: "announcement.create", resource: "Announcement", resourceId: a.id },
      });
      return a;
    });
  }

  async deleteAnnouncement(id: string, actorId: string) {
    await this.db.$transaction(async (tx) => {
      const r = await tx.announcement.deleteMany({ where: { id } });
      if (!r.count) throw new NotFoundException("Announcement not found.");
      await tx.auditLog.create({
        data: { actorId, action: "announcement.delete", resource: "Announcement", resourceId: id },
      });
    });
  }

  async adminNotifications(
    adminUserId: string,
    query?: { filter?: "all" | "published" | "failed" | "weebcentral" | "asurascans"; page?: number },
  ) {
    const base = this.notif
      ? await this.notif.listAdminOperationalNotifications(adminUserId, query)
      : { total: 0, page: 1, filter: query?.filter ?? "all", items: [] };
    const syncStatus = this.sources?.getSyncStatus() ?? null;
    return {
      ...base,
      syncStatus,
    };
  }
}
