import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { Authenticated, AuthUser, CurrentUser, RequireAdmin } from "../auth/auth.guard";
import {
  ChaptersQuery,
  ComicChaptersQuery,
  FallbackCandidatesQuery,
  ImportAlternativeChaptersDto,
  ImportChaptersBodyDto,
  LinkFallbackDto,
  PagesQuery,
  SaveExternalDto,
  SearchSourcesQuery,
  SourceTitleActionDto,
  UpdateSourceDto,
} from "./sources.dto";
import { SourcesService } from "./sources.service";

const SOURCE = "sourceId";

@ApiTags("sources")
@Controller()
export class SourcesController {
  constructor(private svc: SourcesService) {}

  @Get("sources") list() { return this.svc.list(); }
  // Declared before :sourceId so "search" is not read as a source id.
  @RequireAdmin() @Throttle({ default: { limit: 30, ttl: 60_000 } }) @Get("sources/search")
  search(@Query() q: SearchSourcesQuery) { const { source, ...rest } = q; return this.svc.search(source, rest); }
  @Get("sources/:sourceId") one(@Param(SOURCE) id: string) { return this.svc.one(id); }
  @RequireAdmin() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Get("sources/:sourceId/health") health(@Param(SOURCE) id: string) { return this.svc.health(id); }

  /** Providers may opt into cover proxying; the current providers return direct cover URLs. */
  @Throttle({ default: { limit: 240, ttl: 60_000 } }) @Get("sources/:sourceId/cover/:mangaId/:file")
  async cover(@Param(SOURCE) id: string, @Param("mangaId") mangaId: string, @Param("file") file: string, @Res() res: Response) {
    const { body, contentType } = await this.svc.cover(id, mangaId, file);
    this.sendCover(res, body, contentType);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } }) @Get("sources/:sourceId/manga/:externalId")
  details(@Param(SOURCE) id: string, @Param("externalId") ext: string) { return this.svc.details(id, ext); }
  @Throttle({ default: { limit: 60, ttl: 60_000 } }) @Get("sources/:sourceId/manga/:externalId/chapters")
  chapters(@Param(SOURCE) id: string, @Param("externalId") ext: string, @Query() q: ChaptersQuery) { return this.svc.chapters(id, ext, q); }
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) @Get("sources/:sourceId/manga/:externalId/alternatives")
  alternatives(@Param(SOURCE) id: string, @Param("externalId") ext: string, @Query() q: ChaptersQuery) { return this.svc.publicAlternatives(id, ext, q.language); }
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) @Get("sources/:sourceId/manga/:externalId/chapters/:chapterId/pages")
  pages(@Param(SOURCE) id: string, @Param("externalId") externalId: string, @Param("chapterId") chapterId: string, @Query() q: PagesQuery) { return this.svc.publicPages(id, externalId, chapterId, q.quality); }

  // ---- saved titles
  @Authenticated() @Get("user/external-library") library(@CurrentUser() u: AuthUser) { return this.svc.library(u.id); }
  @Authenticated() @Get("user/external-library/:sourceId/:externalId") isSaved(@CurrentUser() u: AuthUser, @Param(SOURCE) s: string, @Param("externalId") e: string) { return this.svc.isSaved(u.id, s, e); }
  @Authenticated() @Throttle({ default: { limit: 30, ttl: 60_000 } }) @HttpCode(200) @Post("user/external-library") save(@CurrentUser() u: AuthUser, @Body() d: SaveExternalDto) { return this.svc.save(u.id, d.sourceId, d.externalId); }
  @Authenticated() @HttpCode(204) @Delete("user/external-library/:sourceId/:externalId") async remove(@CurrentUser() u: AuthUser, @Param(SOURCE) s: string, @Param("externalId") e: string) { await this.svc.remove(u.id, s, e); }

  // ---- admin
  @RequireAdmin() @Throttle({ default: { limit: 30, ttl: 60_000 } }) @Get("admin/sources/catalog/search")
  catalogSearch(@Query() q: SearchSourcesQuery) { const { source, ...rest } = q; return this.svc.adminSearch(source, rest); }
  @RequireAdmin() @Get("admin/sources/catalog/:sourceId/:externalId")
  catalogDetails(@Param(SOURCE) id: string, @Param("externalId") ext: string) { return this.svc.adminDetails(id, ext); }
  @RequireAdmin() @Get("admin/sources/catalog/:sourceId/:externalId/chapters")
  catalogChapters(@Param(SOURCE) id: string, @Param("externalId") ext: string, @Query() q: ChaptersQuery) { return this.svc.adminChapters(id, ext, q); }
  @RequireAdmin() @Get("admin/sources/catalog/:sourceId/:externalId/alternatives")
  catalogAlternatives(@Param(SOURCE) id: string, @Param("externalId") ext: string, @Query() q: ChaptersQuery) { return this.svc.adminAlternatives(id, ext, q.language); }

  // ---- admin fallback management & chapter catalogue routes
  @RequireAdmin() @Get("admin/sources/comics/:id/chapters")
  comicChapters(@Param("id") comicId: string, @Query() q: ComicChaptersQuery) { return this.svc.adminComicChapters(comicId, q); }
  @RequireAdmin() @Throttle({ default: { limit: 30, ttl: 60_000 } }) @Get("admin/sources/comics/:id/fallback-candidates")
  fallbackCandidates(@Param("id") comicId: string, @Query() q: FallbackCandidatesQuery) { return this.svc.adminFallbackCandidates(comicId, q); }
  @RequireAdmin() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @HttpCode(200) @Post("admin/sources/comics/:id/fallbacks")
  linkFallback(@CurrentUser() u: AuthUser, @Param("id") comicId: string, @Body() d: LinkFallbackDto) { return this.svc.linkFallbackSource(comicId, d, u.id); }
  @RequireAdmin() @HttpCode(204) @Delete("admin/sources/comics/:id/fallbacks/:sourceId")
  async unlinkFallback(@CurrentUser() u: AuthUser, @Param("id") comicId: string, @Param(SOURCE) sourceId: string) { await this.svc.unlinkFallbackSource(comicId, sourceId, u.id); }

  @RequireAdmin() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post("admin/sources/comics/:comicId/chapters/import-alternative")
  importAlternativeChapters(@CurrentUser() u: AuthUser, @Param("comicId") comicId: string, @Body() d: ImportAlternativeChaptersDto) {
    return this.svc.importAlternativeChaptersForComic(comicId, d.sourceId, d.externalId, { language: d.language ?? "en", page: d.page ?? 1, limit: d.limit ?? 500 }, u.id);
  }
  @RequireAdmin() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post("admin/sources/catalog/:sourceId/:externalId/approve")
  approve(@CurrentUser() u: AuthUser, @Param(SOURCE) id: string, @Param("externalId") ext: string, @Body() d: SourceTitleActionDto) {
    return this.svc.approve(id, ext, d.language ?? "en", u.id, { chapterSourceId: d.chapterSourceId, chapterExternalId: d.chapterExternalId });
  }
  @RequireAdmin() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(204) @Post("admin/sources/catalog/:sourceId/:externalId/reject")
  reject(@CurrentUser() u: AuthUser, @Param(SOURCE) id: string, @Param("externalId") ext: string, @Body() d: SourceTitleActionDto) { return this.svc.reject(id, ext, d.note, u.id); }
  @RequireAdmin() @HttpCode(204) @Post("admin/sources/catalog/:sourceId/:externalId/unpublish")
  unpublish(@CurrentUser() u: AuthUser, @Param(SOURCE) id: string, @Param("externalId") ext: string) { return this.svc.unpublish(id, ext, u.id); }
  @RequireAdmin() @HttpCode(204) @Post("admin/sources/catalog/:sourceId/:externalId/republish")
  republish(@CurrentUser() u: AuthUser, @Param(SOURCE) id: string, @Param("externalId") ext: string) { return this.svc.republish(id, ext, u.id); }
  @RequireAdmin() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post("admin/sources/catalog/:sourceId/:externalId/chapters/import")
  importChapters(@CurrentUser() u: AuthUser, @Param(SOURCE) id: string, @Param("externalId") ext: string, @Query() q: ChaptersQuery, @Body() body?: ImportChaptersBodyDto) {
    return this.svc.importChapterPage(id, ext, q, u.id, body?.chapterIds);
  }

  @RequireAdmin() @Throttle({ default: { limit: 240, ttl: 60_000 } }) @Get("admin/sources/:sourceId/cover/:mangaId/:file")
  async adminCover(@Param(SOURCE) id: string, @Param("mangaId") mangaId: string, @Param("file") file: string, @Res() res: Response) {
    const { body, contentType } = await this.svc.adminCover(id, mangaId, file);
    this.sendCover(res, body, contentType);
  }

  @RequireAdmin() @Get("admin/sources") adminList() { return this.svc.adminList(); }
  @RequireAdmin() @Get("admin/sources/alerts") adminAlerts() { return this.svc.adminAlerts(); }
  @RequireAdmin() @HttpCode(204) @Put("admin/sources/:sourceId")
  update(@CurrentUser() u: AuthUser, @Param(SOURCE) id: string, @Body() d: UpdateSourceDto) { return this.svc.updateSetting(id, d, u.id); }
  @RequireAdmin() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post("admin/sources/:sourceId/test") test(@Param(SOURCE) id: string) { return this.svc.test(id); }

  private sendCover(res: Response, body: Buffer, contentType: string) {
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(body);
  }
}
