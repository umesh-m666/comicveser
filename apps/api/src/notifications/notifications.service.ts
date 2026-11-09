import { Body, Controller, Get, Global, HttpCode, Injectable, Logger, Module, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { Authenticated, AuthUser, CurrentUser } from "../auth/auth.guard";

class ReadDto { @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) ids?: string[]; }
class SettingsDto { @IsBoolean() newChapter: boolean; }
class PageQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1; }

@Injectable()
export class NotificationsService {
  private log = new Logger("Notifications");
  constructor(private db: PrismaService) {}

  async list(userId: string, page: number) {
    const [unread, items, profile] = await Promise.all([
      this.db.notification.count({ where: { userId, readAt: null } }),
      this.db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20 }),
      this.db.userProfile.findUnique({ where: { userId }, select: { notifyPrefs: true } }),
    ]);
    return { unread, items, prefs: { newChapter: (profile?.notifyPrefs as any)?.newChapter !== false } };
  }
  async markRead(userId: string, ids?: string[]) {
    await this.db.notification.updateMany({ where: { userId, readAt: null, ...(ids?.length && { id: { in: ids } }) }, data: { readAt: new Date() } });
  }
  async setPrefs(userId: string, newChapter: boolean) {
    await this.db.userProfile.upsert({ where: { userId }, update: { notifyPrefs: { newChapter } }, create: { userId, notifyPrefs: { newChapter } } });
  }

  /** Fans out to bookmarkers in batches of 500. In-process for now; move to a queue (BullMQ + Redis) for large audiences. */
  async notifyNewChapter(comicId: string, chapterId: string) {
    const ch = await this.db.chapter.findUnique({ where: { id: chapterId }, select: { number: true, comic: { select: { title: true, slug: true } } } });
    if (!ch) return;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.db.bookmark.findMany({ where: { comicId }, orderBy: { id: "asc" }, take: 500, ...(cursor && { skip: 1, cursor: { id: cursor } }),
        select: { id: true, userId: true, user: { select: { profile: { select: { notifyPrefs: true } } } } } });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      const targets = rows.filter((r) => (r.user.profile?.notifyPrefs as any)?.newChapter !== false);
      if (targets.length) await this.db.notification.createMany({ data: targets.map((r) => ({ userId: r.userId, type: "NEW_CHAPTER" as const,
        title: `${ch.comic.title}: new chapter`, body: `Chapter ${ch.number} is out.`, href: `/comics/${ch.comic.slug}/chapter/${chapterId}` })) });
    }
    this.log.log(`Notified bookmarkers of chapter ${chapterId}`);
  }
}

@ApiTags("notifications")
@Authenticated()
@Controller("user")
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get("notifications") list(@CurrentUser() u: AuthUser, @Query() q: PageQuery) { return this.svc.list(u.id, q.page); }
  @HttpCode(204) @Post("notifications/read") read(@CurrentUser() u: AuthUser, @Body() d: ReadDto) { return this.svc.markRead(u.id, d.ids); }
  @HttpCode(204) @Put("notification-settings") settings(@CurrentUser() u: AuthUser, @Body() d: SettingsDto) { return this.svc.setPrefs(u.id, d.newChapter); }
}

@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
