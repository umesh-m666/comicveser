import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../common/util";
import { StorageService, IMAGE_TYPES } from "../storage/storage.service";
import { randomUUID } from "crypto";
import { CreateComicDto, ListComicsQuery, UpdateComicDto } from "./dto/comic.dto";

const include = { genres: { include: { genre: true } } } satisfies Prisma.ComicInclude;

function normalizeTitleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/^official\s+/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function dedupeByTitle<T extends { id: string; title: string }>(rows: T[]): T[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seenIds.has(row.id)) continue;
    const key = normalizeTitleKey(row.title) || row.id;
    if (seenTitles.has(key)) continue;
    seenIds.add(row.id);
    seenTitles.add(key);
    out.push(row);
  }
  return out;
}

@Injectable()
export class ComicsService {
  constructor(private db: PrismaService, private cache: CacheService, private storage: StorageService) {}

  private get publicWhere(): Prisma.ComicWhereInput {
    return {
      publishState: "PUBLISHED",
      deletedAt: null,
    };
  }

  private mediaUrl(key?: string | null) { return key ? this.storage.readUrl(key) : Promise.resolve(null); }

  private invalidateHomeCaches() {
    return Promise.all(["comics:trending", "comics:popular", "comics:latest"].map((key) => this.cache.delete(key)));
  }

  // Average comes from Rating rows only; it is never stored on the comic.
  async withRatings<T extends { id: string }>(items: T[]) {
    if (!items.length) return [];
    const g = await this.db.rating.groupBy({ by: ["comicId"], where: { comicId: { in: items.map((i) => i.id) } }, _avg: { value: true }, _count: true });
    const m = new Map(g.map((r) => [r.comicId, r]));
    const latest = await this.db.chapter.findMany({
      where: { comicId: { in: items.map((i) => i.id) }, publishState: "PUBLISHED", deletedAt: null },
      orderBy: [{ comicId: "asc" }, { number: "desc" }], distinct: ["comicId"],
      select: { id: true, comicId: true, number: true, publishedAt: true, sourceChapter: { select: { numberLabel: true } } },
    });
    const lm = new Map(latest.map((c) => [c.comicId, c]));
    return Promise.all(items.map(async (i) => {
      const latestChapter = lm.get(i.id);
      return {
        ...i, rating: m.get(i.id)?._avg.value ?? null, ratingCount: m.get(i.id)?._count ?? 0,
        latestChapter: latestChapter ? { id: latestChapter.id, number: latestChapter.number, displayNumber: latestChapter.sourceChapter ? latestChapter.sourceChapter.numberLabel ?? "Special" : String(latestChapter.number), publishedAt: latestChapter.publishedAt } : null,
        coverUrl: (i as { externalCoverUrl?: string | null }).externalCoverUrl ?? await this.mediaUrl((i as { coverKey?: string | null }).coverKey),
        bannerUrl: await this.mediaUrl((i as { bannerKey?: string | null }).bannerKey),
      };
    }));
  }

  async list(q: ListComicsQuery) {
    const where: Prisma.ComicWhereInput = {
      ...this.publicWhere,
      ...(q.q && {
        OR: [
          { title: { contains: q.q, mode: "insensitive" } },
          { altTitle: { contains: q.q, mode: "insensitive" } },
          { author: { contains: q.q, mode: "insensitive" } },
          { artist: { contains: q.q, mode: "insensitive" } },
        ],
      }),
      ...(q.genre && { genres: { some: { genre: { slug: q.genre } } } }),
      ...(q.type && { type: q.type }), ...(q.status && { status: q.status }), ...(q.year && { releaseYear: q.year }),
    };
    const orderBy: Prisma.ComicOrderByWithRelationInput[] = [
      ({ updated: { updatedAt: "desc" }, added: { createdAt: "desc" }, popular: { views: "desc" }, alpha: { title: "asc" } }[q.sort ?? "updated"] as Prisma.ComicOrderByWithRelationInput),
      { createdAt: "desc" },
    ];
    const [total, rows] = await this.db.$transaction([
      this.db.comic.count({ where }),
      this.db.comic.findMany({ where, orderBy, include, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    ]);
    const uniqueRows = dedupeByTitle(rows);
    let items = await this.withRatings(uniqueRows);
    if (q.minRating) items = items.filter((i) => (i.rating ?? 0) >= q.minRating!);
    const adjustedTotal = Math.max(items.length, total - (rows.length - uniqueRows.length));
    return { items, total: adjustedTotal, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(adjustedTotal / q.pageSize)) };
  }

  private async top(orderBy: Prisma.ComicOrderByWithRelationInput, take = 12) {
    const rows = await this.db.comic.findMany({
      where: this.publicWhere,
      orderBy: [orderBy, { createdAt: "desc" }],
      include,
      take: take * 2,
    });
    return this.withRatings(dedupeByTitle(rows).slice(0, take));
  }
  trending() { return this.cache.wrap("comics:trending", 60, () => this.top({ views: "desc" })); }
  popular() { return this.cache.wrap("comics:popular", 60, () => this.top({ views: "desc" })); }
  latest() { return this.cache.wrap("comics:latest", 60, () => this.top({ updatedAt: "desc" })); }

  async bySlug(slug: string) {
    const c = await this.db.comic.findFirst({ where: { slug, ...this.publicWhere }, include });
    if (!c) throw new NotFoundException("Comic not found.");
    const [withRating] = await this.withRatings([c]);
    const chapterCount = await this.db.chapter.count({ where: { comicId: c.id, publishState: "PUBLISHED", deletedAt: null } });
    return { ...withRating, chapterCount };
  }

  async chapters(comicId: string, order: "asc" | "desc" = "desc") {
    const comic = await this.db.comic.findFirst({ where: { id: comicId, ...this.publicWhere }, select: { id: true } });
    if (!comic) throw new NotFoundException("Comic not found.");
    const rows = await this.db.chapter.findMany({
      where: { comicId, publishState: "PUBLISHED", deletedAt: null }, orderBy: { number: order },
      select: { id: true, number: true, title: true, publishedAt: true, sourceChapter: { select: { numberLabel: true } } },
    });
    return rows.map(({ sourceChapter, ...chapter }) => ({ ...chapter, displayNumber: sourceChapter ? sourceChapter.numberLabel ?? "Special" : String(chapter.number) }));
  }

  async genreConnect(slugs: string[]) {
    const found = await this.db.genre.findMany({ where: { slug: { in: slugs } } });
    if (found.length !== new Set(slugs).size) throw new BadRequestException("One or more genres do not exist.");
    return found.map((g) => ({ genre: { connect: { id: g.id } } }));
  }

  async uniqueSlug(title: string) {
    const base = slugify(title) || "comic";
    for (let n = 0; ; n++) {
      const slug = n ? `${base}-${n + 1}` : base;
      if (!(await this.db.comic.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    }
  }

  async coverUploadUrl(contentType: string, size: number) {
    if (!IMAGE_TYPES[contentType] || !Number.isInteger(size) || size < 1 || size > 10 * 1024 * 1024)
      throw new BadRequestException("Cover must be JPEG, PNG, WebP or AVIF and no larger than 10 MB.");
    const key = `comics/covers/${randomUUID()}.${IMAGE_TYPES[contentType]}`;
    return { key, uploadUrl: await this.storage.presignPut(key, contentType), expiresInSeconds: 600 };
  }

  private async validateCoverKey(key?: string) {
    if (!key) return;
    if (!key.startsWith("comics/covers/") || key.includes("..")) throw new BadRequestException("Invalid cover image key.");
    await this.storage.inspect(key);
  }

  async create(dto: CreateComicDto, actor: string) {
    await this.validateCoverKey(dto.coverKey);
    await this.validateCoverKey(dto.bannerKey);
    const { genreSlugs, ...data } = dto;
    const genres = await this.genreConnect(genreSlugs);
    const slug = await this.uniqueSlug(dto.title);
    const comic = await this.db.$transaction(async (tx) => {
      const created = await tx.comic.create({ data: { ...data, slug, genres: { create: genres } }, include });
      await tx.auditLog.create({ data: { actorId: actor, action: "comic.create", resource: "Comic", resourceId: created.id } });
      return created;
    });
    await this.invalidateHomeCaches();
    return comic;
  }

  async update(id: string, dto: UpdateComicDto, actor: string) {
    await this.validateCoverKey(dto.coverKey);
    await this.validateCoverKey(dto.bannerKey);
    const { genreSlugs, ...data } = dto;
    const genres = genreSlugs ? await this.genreConnect(genreSlugs) : undefined;
    const comic = await this.db.$transaction(async (tx) => {
      const exists = await tx.comic.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!exists) throw new NotFoundException("Comic not found.");
      if (genres) await tx.comicGenre.deleteMany({ where: { comicId: id } });
      const updated = await tx.comic.update({ where: { id }, data: { ...data, ...(genres && { genres: { create: genres } }) }, include });
      await tx.auditLog.create({ data: { actorId: actor, action: "comic.update", resource: "Comic", resourceId: id, meta: { fields: Object.keys(dto) } } });
      return updated;
    });
    await this.invalidateHomeCaches();
    return comic;
  }

  async remove(id: string, actor: string) {
    await this.db.$transaction(async (tx) => {
      const current = await tx.comic.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, title: true, slug: true },
      });
      if (!current) throw new NotFoundException("Comic not found.");

      const normCurrent = normalizeTitleKey(current.title);
      const activeComics = await tx.comic.findMany({
        where: { deletedAt: null },
        select: { id: true, title: true, slug: true },
      });
      const sameTitleComics = activeComics.filter(
        (c) => c.id === current.id || (normCurrent && normalizeTitleKey(c.title) === normCurrent),
      );
      const targetIds = Array.from(new Set([current.id, ...sameTitleComics.map((c) => c.id)]));

      const sourceTitles = await tx.sourceTitle.findMany({
        where: { comicId: { in: targetIds } },
        select: { id: true, sourceId: true, externalId: true, comicId: true },
      });
      if (sourceTitles.length > 0) {
        await tx.sourceTitle.deleteMany({ where: { id: { in: sourceTitles.map((st) => st.id) } } });
        for (const st of sourceTitles) {
          await tx.auditLog.create({
            data: {
              actorId: actor,
              action: "source.title.detach_on_comic_delete",
              resource: "SourceTitle",
              resourceId: st.id,
              meta: { sourceId: st.sourceId, externalId: st.externalId, comicId: st.comicId ?? id },
            },
          });
        }
      }

      const now = new Date();
      await tx.chapter.updateMany({
        where: { comicId: { in: targetIds }, deletedAt: null },
        data: { deletedAt: now, publishState: "ARCHIVED" },
      });

      const targetRows = sameTitleComics.length ? sameTitleComics : [{ id: current.id, title: current.title, slug: current.slug }];
      for (const row of targetRows) {
        const archivedSlug = row.slug.includes("-deleted-")
          ? row.slug
          : `${row.slug.slice(0, 160)}-deleted-${row.id.slice(-8)}-${Date.now().toString(36)}`;
        await tx.comic.update({
          where: { id: row.id },
          data: {
            deletedAt: now,
            publishState: "ARCHIVED",
            slug: archivedSlug,
          },
        });
        await tx.auditLog.create({
          data: { actorId: actor, action: "comic.delete", resource: "Comic", resourceId: row.id },
        });
      }
    });

    await this.invalidateHomeCaches();
  }
}
