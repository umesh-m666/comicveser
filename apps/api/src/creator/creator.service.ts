import { Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Authenticated, AuthUser, CurrentUser } from "../auth/auth.guard";
import { ComicsModule } from "../comics/comics.module";
import { ComicsService } from "../comics/comics.service";
import { ChaptersModule } from "../chapters/chapters.module";
import { ChaptersService } from "../chapters/chapters.service";
import { AdminModule } from "../admin/admin.module";
import { AdminService } from "../admin/admin.service";
import { RegisterImagesDto, ReorderDto, UploadUrlDto } from "../chapters/dto/chapter.dto";
import { ApplyDto, CreatorChapterDto, CreatorComicDto } from "./dto/creator.dto";

@Injectable()
export class CreatorService {
  constructor(private db: PrismaService, private comics: ComicsService, private chapters: ChaptersService, private admin: AdminService) {}

  me(userId: string) { return this.db.creator.findUnique({ where: { userId }, select: { id: true, displayName: true, status: true } }); }
  async apply(userId: string, displayName: string) {
    try { await this.db.creator.create({ data: { userId, displayName } }); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ConflictException("You have already applied."); throw e; }
  }
  private async approved(userId: string) {
    const c = await this.db.creator.findUnique({ where: { userId } });
    if (!c) throw new ForbiddenException("Apply to become a creator first.");
    if (c.status !== "APPROVED") throw new ForbiddenException(`Your creator account is ${c.status.toLowerCase()}.`);
    return c;
  }
  private async owns(userId: string, comicId: string) {
    const c = await this.approved(userId);
    if (!(await this.db.creatorComic.findUnique({ where: { creatorId_comicId: { creatorId: c.id, comicId } } }))) throw new NotFoundException("Comic not found.");
  }
  private async ownChapter(userId: string, id: string, mutate = false) {
    const ch = await this.db.chapter.findFirst({ where: { id, deletedAt: null }, select: { id: true, comicId: true, publishState: true } });
    if (!ch) throw new NotFoundException("Chapter not found.");
    await this.owns(userId, ch.comicId);
    if (mutate && ch.publishState === "PUBLISHED") throw new ForbiddenException("Published chapters can only be changed by an admin.");
    return ch;
  }

  async myComics(userId: string) {
    const c = await this.approved(userId);
    return this.db.comic.findMany({ where: { deletedAt: null, creators: { some: { creatorId: c.id } } }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, publishState: true, _count: { select: { chapters: true } } } });
  }
  async submitComic(userId: string, dto: CreatorComicDto) {
    const creator = await this.approved(userId);
    const { genreSlugs, licenseHolder, licenseType, territory, ...data } = dto;
    const genres = await this.comics.genreConnect(genreSlugs); const slug = await this.comics.uniqueSlug(dto.title);
    return this.db.$transaction(async (tx) => {
      const comic = await tx.comic.create({ data: { ...data, slug, publishState: "PENDING", genres: { create: genres },
        creators: { create: { creatorId: creator.id } }, licenses: { create: { holder: licenseHolder, licenseType, territory } } }, select: { id: true } });
      await tx.auditLog.create({ data: { actorId: userId, action: "creator.comic.submit", resource: "Comic", resourceId: comic.id } });
      return comic;
    });
  }
  async comicChapters(userId: string, comicId: string) { await this.owns(userId, comicId); return this.admin.chapters(comicId); }
  async createChapter(userId: string, comicId: string, d: CreatorChapterDto) { await this.owns(userId, comicId); return this.chapters.create({ ...d, comicId, publishState: "DRAFT" }, userId); }
  async chapter(userId: string, id: string) { await this.ownChapter(userId, id); return this.admin.chapter(id); }
  async uploadUrl(userId: string, d: UploadUrlDto) { await this.ownChapter(userId, d.chapterId, true); return this.chapters.uploadUrl(d); }
  async comicCoverUploadUrl(userId: string, contentType: string, size: number) { await this.approved(userId); return this.comics.coverUploadUrl(contentType, size); }
  async register(userId: string, id: string, d: RegisterImagesDto) { await this.ownChapter(userId, id, true); return this.chapters.registerImages(id, d, userId); }
  async reorder(userId: string, id: string, ids: string[]) { await this.ownChapter(userId, id, true); return this.chapters.reorder(id, ids, userId); }
  async deleteImage(userId: string, id: string, imageId: string) { await this.ownChapter(userId, id, true); return this.admin.deleteImage(id, imageId, userId); }
  async submitChapter(userId: string, id: string) {
    await this.ownChapter(userId, id, true);
    await this.db.$transaction(async (tx) => {
      if (!(await tx.chapterImage.count({ where: { chapterId: id } }))) throw new ForbiddenException("Add at least one page before submitting.");
      await tx.chapter.update({ where: { id }, data: { publishState: "PENDING" } });
      await tx.auditLog.create({ data: { actorId: userId, action: "creator.chapter.submit", resource: "Chapter", resourceId: id } });
    });
  }
}

@ApiTags("creator")
@Authenticated()
@Controller("creator")
export class CreatorController {
  constructor(private svc: CreatorService) {}
  @Get("me") async me(@CurrentUser() u: AuthUser) { return (await this.svc.me(u.id)) ?? { status: "NONE" }; }
  @HttpCode(204) @Post("apply") apply(@CurrentUser() u: AuthUser, @Body() d: ApplyDto) { return this.svc.apply(u.id, d.displayName); }
  @Get("comics") comics(@CurrentUser() u: AuthUser) { return this.svc.myComics(u.id); }
  @HttpCode(200) @Post("comic-uploads") coverUpload(@CurrentUser() u: AuthUser, @Body() d: { contentType: string; size: number }) { return this.svc.comicCoverUploadUrl(u.id, d.contentType, d.size); }
  @Post("comics") submit(@CurrentUser() u: AuthUser, @Body() d: CreatorComicDto) { return this.svc.submitComic(u.id, d); }
  @Get("comics/:id/chapters") chapters(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.comicChapters(u.id, id); }
  @Post("comics/:id/chapters") create(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: CreatorChapterDto) { return this.svc.createChapter(u.id, id, d); }
  @Get("chapters/:id") chapter(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.chapter(u.id, id); }
  @HttpCode(200) @Post("uploads") upload(@CurrentUser() u: AuthUser, @Body() d: UploadUrlDto) { return this.svc.uploadUrl(u.id, d); }
  @Post("chapters/:id/images") register(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: RegisterImagesDto) { return this.svc.register(u.id, id, d); }
  @HttpCode(204) @Put("chapters/:id/images/order") reorder(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: ReorderDto) { return this.svc.reorder(u.id, id, d.ids); }
  @HttpCode(204) @Delete("chapters/:id/images/:imageId") del(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("imageId") i: string) { return this.svc.deleteImage(u.id, id, i); }
  @HttpCode(204) @Put("chapters/:id/submit") submitChapter(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.submitChapter(u.id, id); }
}

@Module({ imports: [ComicsModule, ChaptersModule, AdminModule], controllers: [CreatorController], providers: [CreatorService] })
export class CreatorModule {}
