import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SourcesModule } from "../sources/sources.module";
import { SourcesService } from "../sources/sources.service";
import { loadSourceSyncConfig } from "../sources/sources.config";

const OPEN = ["DRAFT", "PENDING", "UNPUBLISHED"] as const;

/** Background housekeeping & automatic provider chapter synchronization. Set DISABLE_JOBS=true on instances that should not run it. */
@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger("Maintenance");
  private timers: NodeJS.Timeout[] = [];
  constructor(
    private db: PrismaService,
    private notes: NotificationsService,
    @Optional() private sources?: SourcesService,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_JOBS === "true") return;
    const every = (ms: number, fn: () => Promise<unknown>, name: string) => {
      const t = setInterval(() => fn().catch((e) => this.log.error(`${name}: ${e.message}`)), ms);
      t.unref();
      this.timers.push(t);
    };
    every(60_000, () => this.publishDue(), "publishDue");
    every(6 * 3600_000, () => this.cleanup(), "cleanup");

    const syncCfg = loadSourceSyncConfig();
    if (syncCfg.enabled && this.sources) {
      this.log.log(
        `Automatic source chapter synchronization enabled (interval=${syncCfg.intervalMinutes}m, batchSize=${syncCfg.batchSize})`,
      );
      every(syncCfg.intervalMs, () => this.syncSourceChapters(), "syncSourceChapters");
      const startupTimer = setTimeout(() => {
        this.syncSourceChapters().catch((e) => this.log.error(`syncSourceChapters(startup): ${e.message}`));
      }, 15_000);
      startupTimer.unref();
      this.timers.push(startupTimer);
    }
  }

  onModuleDestroy() {
    this.timers.forEach((t) => {
      clearInterval(t);
      clearTimeout(t);
    });
    this.timers = [];
  }

  /** Automatically detects and publishes new chapters from WeebCentral and AsuraScans for approved published comics. */
  async syncSourceChapters() {
    if (!this.sources) return null;
    const syncCfg = loadSourceSyncConfig();
    if (!syncCfg.enabled) return null;
    return this.sources.runAutomaticChapterSync();
  }

  /** Publishes chapters whose scheduled time has passed. Safe if two instances race: only one update succeeds. */
  async publishDue() {
    const due = await this.db.chapter.findMany({
      where: { deletedAt: null, scheduledAt: { lte: new Date() }, publishState: { in: [...OPEN] }, images: { some: {} } },
      select: { id: true, comicId: true },
      take: 50,
    });
    for (const c of due) {
      const won = await this.db.$transaction(async (tx) => {
        const r = await tx.chapter.updateMany({
          where: { id: c.id, publishState: { in: [...OPEN] } },
          data: { publishState: "PUBLISHED", publishedAt: new Date(), scheduledAt: null },
        });
        if (!r.count) return false;
        await tx.comic.update({ where: { id: c.comicId }, data: { updatedAt: new Date() } });
        await tx.auditLog.create({
          data: { actorLabel: "scheduler", action: "chapter.scheduled_publish", resource: "Chapter", resourceId: c.id },
        });
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

@Module({
  imports: [SourcesModule],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
