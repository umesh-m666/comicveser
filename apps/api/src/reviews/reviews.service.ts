import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Authenticated, AuthUser, CurrentUser } from "../auth/auth.guard";

class RatingDto { @IsInt() @Min(1) @Max(10) value: number; }
class ReviewDto { @IsString() @Length(10, 3000) body: string; }
class ReportDto { @IsIn(["REVIEW", "COMIC", "COMMENT"]) targetType: string; @IsString() @Length(10, 40) targetId: string; @IsString() @Length(5, 500) reason: string; }
class PageQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1; }
const write = { default: { limit: 10, ttl: 60_000 } };

@Injectable()
export class ReviewsService {
  constructor(private db: PrismaService) {}
  private async comic(id: string) {
    if (!(await this.db.comic.findFirst({ where: { id, publishState: "PUBLISHED", deletedAt: null, OR: [{ sourceTitle: { is: null } }, { sourceTitle: { is: { state: "APPROVED" } } }] }, select: { id: true } }))) throw new NotFoundException("Comic not found.");
  }

  async list(comicId: string, page: number) {
    await this.comic(comicId);
    const where = { comicId, deletedAt: null };
    const [total, rows, agg] = await Promise.all([
      this.db.review.count({ where }),
      this.db.review.findMany({ where, orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }], skip: (page - 1) * 10, take: 10, include: { user: { select: { id: true, username: true } } } }),
      this.db.rating.aggregate({ where: { comicId }, _avg: { value: true }, _count: true }),
    ]);
    const ratings = await this.db.rating.findMany({ where: { comicId, userId: { in: rows.map((r) => r.userId) } }, select: { userId: true, value: true } });
    const rm = new Map(ratings.map((r) => [r.userId, r.value]));
    return { average: agg._avg.value, ratingCount: agg._count, total, page, pages: Math.max(1, Math.ceil(total / 10)),
      items: rows.map((r) => ({ id: r.id, body: r.body, helpfulCount: r.helpfulCount, createdAt: r.createdAt, user: r.user, rating: rm.get(r.userId) ?? null })) };
  }
  async mine(userId: string, comicId: string) {
    await this.comic(comicId);
    const [rating, review] = await Promise.all([
      this.db.rating.findUnique({ where: { userId_comicId: { userId, comicId } } }),
      this.db.review.findFirst({ where: { userId, comicId, deletedAt: null } }),
    ]);
    return { rating: rating?.value ?? null, review: review ? { id: review.id, body: review.body } : null };
  }
  async rate(userId: string, comicId: string, value: number) {
    await this.comic(comicId);
    await this.db.rating.upsert({ where: { userId_comicId: { userId, comicId } }, update: { value }, create: { userId, comicId, value } }); // one rating per user per comic
  }
  async write(u: AuthUser, comicId: string, body: string) {
    if (!u.emailVerified) throw new ForbiddenException("Verify your email before writing a review.");
    await this.comic(comicId);
    await this.db.review.upsert({ where: { userId_comicId: { userId: u.id, comicId } }, update: { body, deletedAt: null }, create: { userId: u.id, comicId, body } });
  }
  async update(userId: string, id: string, body: string) {
    const r = await this.db.review.updateMany({ where: { id, userId, deletedAt: null }, data: { body } });
    if (!r.count) throw new NotFoundException("Review not found.");
  }
  async remove(u: AuthUser, id: string) {
    const rev = await this.db.review.findFirst({ where: { id, deletedAt: null } });
    if (!rev) throw new NotFoundException("Review not found.");
    const mod = u.permissions.includes("review:moderate");
    if (rev.userId !== u.id && !mod) throw new ForbiddenException("You can only delete your own reviews.");
    await this.db.$transaction([
      this.db.review.update({ where: { id }, data: { deletedAt: new Date() } }),
      ...(rev.userId !== u.id ? [this.db.auditLog.create({ data: { actorId: u.id, action: "review.delete", resource: "Review", resourceId: id } })] : []),
    ]);
  }
  async helpful(userId: string, id: string) {
    const rev = await this.db.review.findFirst({ where: { id, deletedAt: null } });
    if (!rev) throw new NotFoundException("Review not found.");
    if (rev.userId === userId) throw new ForbiddenException("You can't vote on your own review.");
    try { await this.db.$transaction([this.db.reviewVote.create({ data: { userId, reviewId: id } }), this.db.review.update({ where: { id }, data: { helpfulCount: { increment: 1 } } })]); }
    catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; } // already voted
  }
  async report(userId: string, d: ReportDto) {
    const exists = d.targetType === "REVIEW" ? await this.db.review.findFirst({ where: { id: d.targetId, deletedAt: null }, select: { id: true } })
      : d.targetType === "COMIC" ? await this.db.comic.findFirst({ where: { id: d.targetId, publishState: "PUBLISHED", deletedAt: null, OR: [{ sourceTitle: { is: null } }, { sourceTitle: { is: { state: "APPROVED" } } }] }, select: { id: true } }) : { id: d.targetId };
    if (!exists) throw new NotFoundException("Nothing to report.");
    if (await this.db.report.findFirst({ where: { reporterId: userId, targetType: d.targetType, targetId: d.targetId, status: "OPEN" }, select: { id: true } })) return;
    await this.db.report.create({ data: { reporterId: userId, targetType: d.targetType, targetId: d.targetId, reason: d.reason } });
  }
}

@ApiTags("reviews")
@Controller()
export class ReviewsController {
  constructor(private svc: ReviewsService) {}
  @Get("comics/:id/reviews") list(@Param("id") id: string, @Query() q: PageQuery) { return this.svc.list(id, q.page); }
  @Authenticated() @Get("comics/:id/mine") mine(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.mine(u.id, id); }
  @Authenticated() @Throttle(write) @HttpCode(204) @Put("comics/:id/rating") rate(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: RatingDto) { return this.svc.rate(u.id, id, d.value); }
  @Authenticated() @Throttle(write) @HttpCode(204) @Post("comics/:id/reviews") write(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: ReviewDto) { return this.svc.write(u, id, d.body); }
  @Authenticated() @Throttle(write) @HttpCode(204) @Put("reviews/:id") update(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: ReviewDto) { return this.svc.update(u.id, id, d.body); }
  @Authenticated() @HttpCode(204) @Delete("reviews/:id") remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
  @Authenticated() @Throttle(write) @HttpCode(204) @Post("reviews/:id/helpful") helpful(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.helpful(u.id, id); }
  @Authenticated() @Throttle(write) @HttpCode(204) @Post("reports") report(@CurrentUser() u: AuthUser, @Body() d: ReportDto) { return this.svc.report(u.id, d); }
}

@Module({ controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
