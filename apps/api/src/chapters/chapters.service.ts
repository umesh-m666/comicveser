import { resolveChapterDisplayNumber } from "../sources/chapter-display";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { SourcesService } from "../sources/sources.service";
import { IMAGE_TYPES, StorageService } from "../storage/storage.service";
import { CreateChapterDto, RegisterImagesDto, UpdateChapterDto, UploadUrlDto } from "./dto/chapter.dto";

@Injectable()
export class ChaptersService {
  constructor(private db: PrismaService, private storage: StorageService, private notes: NotificationsService, private sources: SourcesService) {}

  private get liveWhere(): Prisma.ChapterWhereInput {
    return {
      publishState: "PUBLISHED",
      deletedAt: null,
      comic: {
        publishState: "PUBLISHED",
        deletedAt: null,
        OR: this.db.publicComicOrFilter,
      },
    };
  }

  async meta(id: string) {
    const ch = await this.db.chapter.findFirst({ where: { id, ...this.liveWhere }, include: {
      comic: { select: { id: true, slug: true, title: true } },
      sourceChapter: { include: { sourceTitle: { select: { state: true, sourceId: true, externalId: true } } } },
      _count: { select: { images: true } },
    } });
    if (!ch || (ch.sourceChapter && ch.sourceChapter.sourceTitle.state !== "APPROVED")) throw new NotFoundException("Chapter not found.");
    const near = (cmp: "lt" | "gt") => this.db.chapter.findFirst({
      where: { comicId: ch.comicId, publishState: "PUBLISHED", deletedAt: null, number: { [cmp]: ch.number } },
      orderBy: { number: cmp === "lt" ? "desc" : "asc" }, select: { id: true, number: true, title: true, sourceChapter: { select: { numberLabel: true, title: true } } } });
    const [prev, next] = await Promise.all([near("lt"), near("gt")]);
    const nav = (entry: typeof prev) => entry ? { id: entry.id, number: entry.number, displayNumber: resolveChapterDisplayNumber(entry, entry.sourceChapter) } : null;

    // Every SourceChapter retains its own SourceTitle relationship (e.g. WeebCentral or Asura Scans),
    // ensuring the reader resolves through the chapter's original source provider.
    let external = ch.sourceChapter ? {
      sourceId: ch.sourceChapter.sourceTitle.sourceId,
      mangaId: ch.sourceChapter.sourceTitle.externalId,
      chapterId: ch.sourceChapter.externalId,
      sourceUrl: ch.sourceChapter.sourceUrl,
      groups: ch.sourceChapter.groups,
      readerUrl: `/sources/${encodeURIComponent(ch.sourceChapter.sourceTitle.sourceId)}/${encodeURIComponent(ch.sourceChapter.sourceTitle.externalId)}/read/${encodeURIComponent(ch.sourceChapter.externalId)}?lang=${encodeURIComponent(ch.sourceChapter.language ?? "en")}`,
    } : undefined;
    let alternatives: Awaited<ReturnType<SourcesService["resolveAlternativeForComicChapter"]>>["alternatives"] = [];

    if (ch.sourceChapter && ch.sourceChapter.sourceTitle.sourceId === "comick") {
      const resolved = await this.sources.resolveAlternativeForComicChapter(ch.id);
      if (resolved.external) {
        external = resolved.external;
      }
      alternatives = resolved.alternatives;
    }

    return {
      id: ch.id, number: ch.number, displayNumber: resolveChapterDisplayNumber(ch, ch.sourceChapter), title: ch.title,
      comic: ch.comic, imageCount: ch.sourceChapter?.pageCount ?? ch._count.images, prev: nav(prev), next: nav(next),
      ...(external && { external }),
      ...(alternatives.length > 0 && { alternatives }),
    };
  }

  // Images are served in small batches so the reader never loads a whole chapter at once.
  async images(id: string, from: number, limit: number) {
    const chapter = await this.db.chapter.findFirst({ where: { id, ...this.liveWhere }, include: { sourceChapter: true } });
    if (!chapter) throw new NotFoundException("Chapter not found.");
    if (chapter.sourceChapter) {
      const sourcePages = await this.sources.publishedChapterPages(id, from, limit);
      if (!sourcePages) throw new NotFoundException("Chapter not found.");
      return sourcePages;
    }
    const [total, rows] = await this.db.$transaction([
      this.db.chapterImage.count({ where: { chapterId: id } }),
      this.db.chapterImage.findMany({ where: { chapterId: id }, orderBy: { position: "asc" }, skip: from, take: limit }),
    ]);
    const items = await Promise.all(rows.map(async (r: { id: string; position: number; width: number; height: number; storageKey: string }) => ({ id: r.id, position: r.position, width: r.width, height: r.height, url: await this.storage.readUrl(r.storageKey) })));
    return { total, from, items };
  }

  async create(dto: CreateChapterDto, actorId: string) {
    const comic = await this.db.comic.findFirst({ where: { id: dto.comicId, deletedAt: null }, select: { id: true } });
    if (!comic) throw new NotFoundException("Comic not found.");
    return this.db.$transaction(async (tx) => {
      const ch = await tx.chapter.create({ data: { ...dto, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        publishedAt: dto.publishState === "PUBLISHED" ? new Date() : undefined } });
      if (ch.publishState === "PUBLISHED") await tx.comic.update({ where: { id: comic.id }, data: { updatedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: "chapter.create", resource: "Chapter", resourceId: ch.id } });
      return ch;
    });
  }

  async update(id: string, dto: UpdateChapterDto, actorId: string) {
    const { ch, publishing } = await this.db.$transaction(async (tx) => {
      const cur = await tx.chapter.findFirst({ where: { id, deletedAt: null } });
      if (!cur) throw new NotFoundException("Chapter not found.");
      const publishing = dto.publishState === "PUBLISHED" && cur.publishState !== "PUBLISHED";
      if (publishing && (await tx.chapterImage.count({ where: { chapterId: id } })) === 0)
        throw new BadRequestException("Add at least one image before publishing.");
      const ch = await tx.chapter.update({ where: { id }, data: { ...dto, scheduledAt: dto.scheduledAt === null ? null : dto.scheduledAt ? new Date(dto.scheduledAt) : undefined, ...(publishing && { publishedAt: new Date() }) } });
      if (publishing) await tx.comic.update({ where: { id: cur.comicId }, data: { updatedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: "chapter.update", resource: "Chapter", resourceId: id, meta: { fields: Object.keys(dto) } } });
      return { ch, publishing };
    });
    if (publishing) void this.notes.notifyNewChapter(ch.comicId, ch.id).catch(() => undefined); // runs after the response path, in batches
    return ch;
  }

  async uploadUrl(dto: UploadUrlDto) {
    if (!(await this.db.chapter.findFirst({ where: { id: dto.chapterId, deletedAt: null }, select: { id: true } }))) throw new NotFoundException("Chapter not found.");
    const key = `chapters/${dto.chapterId}/${randomUUID()}.${IMAGE_TYPES[dto.contentType]}`; // server-chosen name
    return { key, uploadUrl: await this.storage.presignPut(key, dto.contentType), expiresInSeconds: 600 };
  }

  async registerImages(chapterId: string, dto: RegisterImagesDto, actorId: string) {
    if (!(await this.db.chapter.findFirst({ where: { id: chapterId, deletedAt: null }, select: { id: true } }))) throw new NotFoundException("Chapter not found.");
    const prefix = `chapters/${chapterId}/`;
    const checked: { key: string; width: number; height: number; sha256: string }[] = [];
    for (const it of dto.items) {
      if (!it.key.startsWith(prefix) || it.key.includes("..")) throw new BadRequestException("Invalid image key.");
      checked.push({ ...it, ...(await this.storage.inspect(it.key)) }); // server-measured size overrides client values
    }
    try {
      return await this.db.$transaction(async (tx) => {
        let pos = ((await tx.chapterImage.aggregate({ where: { chapterId }, _max: { position: true } }))._max.position ?? -1) + 1;
        const out = [];
        for (const c of checked) out.push(await tx.chapterImage.create({ data: { chapterId, position: pos++, storageKey: c.key, width: c.width, height: c.height, sha256: c.sha256 }, select: { id: true, position: true } }));
        await tx.auditLog.create({ data: { actorId, action: "chapter.images.add", resource: "Chapter", resourceId: chapterId, meta: { count: out.length } } });
        return out;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ConflictException("One of these images is already in this chapter.");
      throw e;
    }
  }

  async reorder(chapterId: string, ids: string[], actorId: string) {
    const existing = await this.db.chapterImage.findMany({ where: { chapterId }, select: { id: true } });
    if (existing.length !== ids.length || new Set(ids).size !== ids.length || !existing.every((e: { id: string }) => ids.includes(e.id)))
      throw new BadRequestException("The list must contain every image in this chapter exactly once.");
    await this.db.$transaction([
      ...ids.map((id: string, i: number) => this.db.chapterImage.update({ where: { id }, data: { position: 100000 + i } })), // avoid unique clashes
      ...ids.map((id: string, i: number) => this.db.chapterImage.update({ where: { id }, data: { position: i } })),
      this.db.auditLog.create({ data: { actorId, action: "chapter.images.reorder", resource: "Chapter", resourceId: chapterId } }),
    ]);
  }
}
