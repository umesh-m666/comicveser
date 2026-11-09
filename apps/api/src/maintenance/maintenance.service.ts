import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const OPEN = ["DRAFT", "PENDING", "UNPUBLISHED"] as const;

/** Background housekeeping. Set DISABLE_JOBS=true on instances that should not run it (e.g. extra replicas, tests). */
@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger("Maintenance");
  private timers: NodeJS.Timeout[] = [];
  constructor(private db: PrismaService, private notes: NotificationsService) {}

  onModuleInit() {
    if (process.env.DISABLE_JOBS === "true") return;
    const every = (ms: number, fn: () => Promise<unknown>, name: string) => { const t = setInterval(() => fn().catch((e) => this.log.error(`${name}: ${e.message}`)), ms); t.unref(); this.timers.push(t); };
    every(60_000, () => this.publishDue(), "publishDue");
    every(6 * 3600_000, () => this.cleanup(), "cleanup");
  }
  onModuleDestroy() { this.timers.forEach(clearInterval); }

  /** Publishes chapters whose scheduled time has passed. Safe if two instances race: only one update succeeds. */
  async publishDue() {
    const due = await this.db.chapter.findMany({ where: { deletedAt: null, scheduledAt: { lte: new Date() }, publishState: { in: [...OPEN] }, images: { some: {} } }, select: { id: true, comicId: true }, take: 50 });
    for (const c of due) {
      const won = await this.db.$transaction(async (tx) => {
        const r = await tx.chapter.updateMany({ where: { id: c.id, publishState: { in: [...OPEN] } }, data: { publishState: "PUBLISHED", publishedAt: new Date(), scheduledAt: null } });
        if (!r.count) return false;
        await tx.comic.update({ where: { id: c.comicId }, data: { updatedAt: new Date() } });
        await tx.auditLog.create({ data: { actorLabel: "scheduler", action: "chapter.scheduled_publish", resource: "Chapter", resourceId: c.id } });
        return true;
      });
      if (won) void this.notes.notifyNewChapter(c.comicId, c.id).catch(() => undefined);
    }
    if (due.length) this.log.log(`Checked ${due.length} scheduled chapter(s)`);
  }

  /** Removes expired sessions and tokens, and analytics older than 400 days. */
  async cleanup() {
    const now = Date.now();
    const [s, t, a] = await Promise.all([
      this.db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      this.db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 7 * 864e5) } } }),
      this.db.analyticsEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 400 * 864e5) } } }),
    ]);
    this.log.log(`Cleanup removed ${s.count} sessions, ${t.count} tokens, ${a.count} analytics rows`);
  }
}
@Module({ providers: [MaintenanceService] })
export class MaintenanceModule {}
