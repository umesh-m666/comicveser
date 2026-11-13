import { Controller, Get, Injectable, Module, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { ComicsModule } from "../comics/comics.module";
import { ComicsService } from "../comics/comics.service";
import { optionalUserId } from "../common/optional-user";

/** Rule-based for now. Keep this class's public interface stable so a learned model can replace the scoring later. */
@Injectable()
export class RecommendationsService {
  constructor(private db: PrismaService, private comics: ComicsService) {}

  async forUser(userId: string | null) {
    if (!userId) return { personalized: false, items: await this.comics.popular() };
    const genres = { select: { genres: { select: { genreId: true } } } };
    const [bms, rated, hist] = await Promise.all([
      this.db.bookmark.findMany({ where: { userId }, select: { comicId: true, comic: genres } }),
      this.db.rating.findMany({ where: { userId, value: { gte: 7 } }, select: { value: true, comic: genres } }),
      this.db.readingHistory.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 50, select: { comicId: true, comic: genres } }),
    ]);
    const w = new Map<string, number>();
    const add = (gs: { genreId: string }[], weight: number) => gs.forEach((g) => w.set(g.genreId, (w.get(g.genreId) ?? 0) + weight));
    bms.forEach((b) => add(b.comic.genres, 3));            // bookmarks: strongest signal
    rated.forEach((r) => add(r.comic.genres, (r.value - 6) / 2)); // ratings 7..10 -> 0.5..2
    hist.forEach((h) => add(h.comic.genres, 1));           // reading history
    if (!w.size) return { personalized: false, items: await this.comics.popular() };

    const seen = [...new Set([...bms, ...hist].map((x) => x.comicId))];
    const cands = await this.db.comic.findMany({ where: {
      publishState: "PUBLISHED", deletedAt: null, id: { notIn: seen },
      OR: this.db.publicComicOrFilter,
    }, orderBy: { views: "desc" }, take: 200, include: { genres: { include: { genre: true } } } });
    const recent = Date.now() - 30 * 864e5;
    const score = (c: (typeof cands)[number]) => c.genres.reduce((s, g) => s + (w.get(g.genreId) ?? 0), 0) + Math.log10(c.views + 1) * 0.5 + (c.updatedAt.getTime() > recent ? 1 : 0);
    const top = cands.map((c) => ({ c, s: score(c) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((x) => x.c);
    return { personalized: true, items: await this.comics.withRatings(top) };
  }
}

@ApiTags("recommendations")
@Controller()
export class RecommendationsController {
  constructor(private svc: RecommendationsService, private db: PrismaService) {}
  @Get("recommendations") async get(@Req() req: any) { return this.svc.forUser(await optionalUserId(this.db, req)); }
}

@Module({ imports: [ComicsModule], controllers: [RecommendationsController], providers: [RecommendationsService] })
export class RecommendationsModule {}
