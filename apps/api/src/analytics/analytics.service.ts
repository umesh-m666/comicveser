import { Body, Controller, Get, HttpCode, Injectable, Module, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RequirePermission } from "../auth/auth.guard";
import { optionalUserId } from "../common/optional-user";

const TYPES = ["PAGE_VIEW", "COMIC_VIEW", "CHAPTER_VIEW", "SEARCH", "READ_SESSION"];
class EventDto {
  @IsIn(TYPES) type: string;
  @IsOptional() @IsString() @Length(10, 40) comicId?: string;
  @IsOptional() @IsString() @Length(10, 40) chapterId?: string;
  @IsOptional() @IsString() @Length(1, 200) path?: string;
  @IsOptional() @IsString() @Length(1, 100) query?: string;
}
class RangeQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) days: number = 30; }

@Injectable()
export class AnalyticsService {
  constructor(private db: PrismaService) {}

  // The browser only calls this after the visitor accepts the consent banner. No IP address or cookie id is stored.
  async record(userId: string | null, d: EventDto) {
    let comicId = d.comicId;
    if (d.type === "COMIC_VIEW" && comicId) {
      const r = await this.db.comic.updateMany({ where: {
        id: comicId, publishState: "PUBLISHED", deletedAt: null,
        OR: this.db.publicComicOrFilter,
      }, data: { views: { increment: 1 } } });
      if (!r.count) comicId = undefined;
    }
    await this.db.analyticsEvent.create({ data: { type: d.type, userId, comicId, chapterId: d.chapterId,
      path: d.path?.split("?")[0], query: d.type === "SEARCH" ? d.query?.trim().toLowerCase() : undefined } });
  }

  async summary(days: number) {
    const since = new Date(Date.now() - days * 864e5);
    const [daily, dau, searches, comicViews] = await Promise.all([
      this.db.$queryRaw<{ day: Date; type: string; n: number }[]>(Prisma.sql`SELECT date_trunc('day', "createdAt")::date AS day, "type", COUNT(*)::int AS n FROM "AnalyticsEvent" WHERE "createdAt" >= ${since} GROUP BY 1, 2 ORDER BY 1`),
      this.db.$queryRaw<{ day: Date; n: number }[]>(Prisma.sql`SELECT date_trunc('day', "createdAt")::date AS day, COUNT(DISTINCT "userId")::int AS n FROM "AnalyticsEvent" WHERE "createdAt" >= ${since} AND "userId" IS NOT NULL GROUP BY 1 ORDER BY 1`),
      this.db.analyticsEvent.groupBy({ by: ["query"], where: { type: "SEARCH", createdAt: { gte: since }, query: { not: null } }, _count: { _all: true }, orderBy: { _count: { query: "desc" } }, take: 10 }),
      this.db.analyticsEvent.groupBy({ by: ["comicId"], where: { type: "COMIC_VIEW", createdAt: { gte: since }, comicId: { not: null } }, _count: { _all: true }, orderBy: { _count: { comicId: "desc" } }, take: 100 }),
    ]);
    const ids = comicViews.map((c) => c.comicId!);
    const [comics, links] = await Promise.all([
      this.db.comic.findMany({ where: { id: { in: ids.slice(0, 10) } }, select: { id: true, title: true } }),
      this.db.comicGenre.findMany({ where: { comicId: { in: ids } }, include: { genre: { select: { name: true } } } }),
    ]);
    const title = new Map(comics.map((c) => [c.id, c.title]));
    const views = new Map(comicViews.map((c) => [c.comicId!, c._count._all]));
    const genres = new Map<string, number>();
    for (const l of links) genres.set(l.genre.name, (genres.get(l.genre.name) ?? 0) + (views.get(l.comicId) ?? 0));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return {
      days, daily: daily.map((r) => ({ day: iso(r.day), type: r.type, n: r.n })), activeUsers: dau.map((r) => ({ day: iso(r.day), n: r.n })),
      topSearches: searches.map((s) => ({ query: s.query, n: s._count._all })),
      topComics: comicViews.slice(0, 10).map((c) => ({ title: title.get(c.comicId!) ?? "(removed)", n: c._count._all })),
      topGenres: [...genres].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
    };
  }
}

@ApiTags("analytics")
@Controller()
export class AnalyticsController {
  constructor(private svc: AnalyticsService, private db: PrismaService) {}
  @Throttle({ default: { limit: 60, ttl: 60_000 } }) @HttpCode(204) @Post("analytics/event")
  async event(@Req() req: any, @Body() d: EventDto) { await this.svc.record(await optionalUserId(this.db, req), d); }
  @RequirePermission("audit:read") @Get("admin/analytics") summary(@Query() q: RangeQuery) { return this.svc.summary(q.days); }
}

@Module({ controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
