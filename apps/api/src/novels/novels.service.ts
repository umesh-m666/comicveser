import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser, CurrentUser, RequirePermission } from "../auth/auth.guard";
import { slugify } from "../common/util";
import { CreateNovelChapterDto, CreateNovelDto, NovelListQuery, UpdateNovelChapterDto, UpdateNovelDto } from "./dto/novel.dto";

const LIVE: Prisma.NovelWhereInput = { publishState: "PUBLISHED", deletedAt: null };
const PUB = { publishState: "PUBLISHED" as const };

@Injectable()
export class NovelsService {
  constructor(private db: PrismaService) {}

  async list(q: NovelListQuery) {
    const where: Prisma.NovelWhereInput = { ...LIVE, ...(q.q && { title: { contains: q.q, mode: "insensitive" } }) };
    const [total, rows] = await Promise.all([
      this.db.novel.count({ where }),
      this.db.novel.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (q.page - 1) * 12, take: 12,
        select: { id: true, slug: true, title: true, author: true, genres: true, status: true, _count: { select: { chapters: { where: PUB } } } } }),
    ]);
    return { total, page: q.page, pages: Math.max(1, Math.ceil(total / 12)), items: rows.map(({ _count, ...n }) => ({ ...n, chapterCount: _count.chapters })) };
  }
  async bySlug(slug: string) {
    const n = await this.db.novel.findFirst({ where: { slug, ...LIVE }, include: { chapters: { where: PUB, orderBy: { number: "asc" }, select: { id: true, number: true, title: true, publishedAt: true } } } });
    if (!n) throw new NotFoundException("Novel not found.");
    return n;
  }
  async chapter(slug: string, id: string) {
    const ch = await this.db.novelChapter.findFirst({ where: { id, ...PUB, novel: { slug, ...LIVE } }, include: { novel: { select: { id: true, slug: true, title: true } } } });
    if (!ch) throw new NotFoundException("Chapter not found.");
    const near = (cmp: "lt" | "gt") => this.db.novelChapter.findFirst({ where: { novelId: ch.novelId, ...PUB, number: { [cmp]: ch.number } }, orderBy: { number: cmp === "lt" ? "desc" : "asc" }, select: { id: true, number: true } });
    const [prev, next] = await Promise.all([near("lt"), near("gt")]);
    return { id: ch.id, number: ch.number, title: ch.title, body: ch.body, novel: ch.novel, prev, next };
  }

  adminList() { return this.db.novel.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { chapters: true } } } }); }
  async adminOne(id: string) {
    const n = await this.db.novel.findFirst({ where: { id, deletedAt: null }, include: { chapters: { orderBy: { number: "desc" }, select: { id: true, number: true, title: true, publishState: true } } } });
    if (!n) throw new NotFoundException("Novel not found.");
    return n;
  }
  private async slug(title: string) {
    const base = slugify(title) || "novel";
    for (let i = 0; ; i++) { const s = i ? `${base}-${i + 1}` : base; if (!(await this.db.novel.findUnique({ where: { slug: s }, select: { id: true } }))) return s; }
  }
  async create(d: CreateNovelDto, actorId: string) {
    const slug = await this.slug(d.title);
    return this.db.$transaction(async (tx) => {
      const n = await tx.novel.create({ data: { ...d, slug } });
      await tx.auditLog.create({ data: { actorId, action: "novel.create", resource: "Novel", resourceId: n.id } });
      return n;
    });
  }
  async update(id: string, d: UpdateNovelDto, actorId: string) {
    return this.db.$transaction(async (tx) => {
      if (!(await tx.novel.findFirst({ where: { id, deletedAt: null }, select: { id: true } }))) throw new NotFoundException("Novel not found.");
      const n = await tx.novel.update({ where: { id }, data: d });
      await tx.auditLog.create({ data: { actorId, action: "novel.update", resource: "Novel", resourceId: id } });
      return n;
    });
  }
  async addChapter(novelId: string, d: CreateNovelChapterDto, actorId: string) {
    if (!(await this.db.novel.findFirst({ where: { id: novelId, deletedAt: null }, select: { id: true } }))) throw new NotFoundException("Novel not found.");
    return this.db.$transaction(async (tx) => {
      const c = await tx.novelChapter.create({ data: { ...d, novelId, publishedAt: d.publishState === "PUBLISHED" ? new Date() : undefined }, select: { id: true } });
      if (d.publishState === "PUBLISHED") await tx.novel.update({ where: { id: novelId }, data: { updatedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: "novel.chapter.create", resource: "NovelChapter", resourceId: c.id } });
      return c;
    });
  }
  async updateChapter(id: string, d: UpdateNovelChapterDto, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const cur = await tx.novelChapter.findUnique({ where: { id } });
      if (!cur) throw new NotFoundException("Chapter not found.");
      const publishing = d.publishState === "PUBLISHED" && cur.publishState !== "PUBLISHED";
      await tx.novelChapter.update({ where: { id }, data: { ...d, ...(publishing && { publishedAt: new Date() }) } });
      if (publishing) await tx.novel.update({ where: { id: cur.novelId }, data: { updatedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: "novel.chapter.update", resource: "NovelChapter", resourceId: id } });
    });
  }
}

@ApiTags("novels")
@Controller()
export class NovelsController {
  constructor(private svc: NovelsService) {}
  @Get("novels") list(@Query() q: NovelListQuery) { return this.svc.list(q); }
  @Get("novels/:slug") one(@Param("slug") s: string) { return this.svc.bySlug(s); }
  @Get("novels/:slug/chapters/:id") chapter(@Param("slug") s: string, @Param("id") id: string) { return this.svc.chapter(s, id); }

  @RequirePermission("comic:write") @Get("admin/novels") adminList() { return this.svc.adminList(); }
  @RequirePermission("comic:write") @Get("admin/novels/:id") adminOne(@Param("id") id: string) { return this.svc.adminOne(id); }
  @RequirePermission("comic:write") @Post("admin/novels") create(@CurrentUser() u: AuthUser, @Body() d: CreateNovelDto) { return this.svc.create(d, u.id); }
  @RequirePermission("comic:write") @Put("admin/novels/:id") update(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: UpdateNovelDto) { return this.svc.update(id, d, u.id); }
  @RequirePermission("comic:write") @Post("admin/novels/:id/chapters") addChapter(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: CreateNovelChapterDto) { return this.svc.addChapter(id, d, u.id); }
  @RequirePermission("comic:write") @Put("admin/novel-chapters/:id") updateChapter(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: UpdateNovelChapterDto) { return this.svc.updateChapter(id, d, u.id); }
}

@Module({ controllers: [NovelsController], providers: [NovelsService] })
export class NovelsModule {}
