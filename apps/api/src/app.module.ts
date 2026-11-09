import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.service";
import { ComicsModule } from "./comics/comics.module";
import { MailModule } from "./mail/mail.service";
import { AuthModule } from "./auth/auth.module";
import { OriginGuard } from "./auth/auth.guard";
import { ChaptersModule } from "./chapters/chapters.module";
import { AdminModule } from "./admin/admin.module";
import { NotificationsModule } from "./notifications/notifications.service";
import { ReviewsModule } from "./reviews/reviews.service";
import { NovelsModule } from "./novels/novels.service";
import { CreatorModule } from "./creator/creator.service";
import { BillingModule } from "./billing/billing.service";
import { AnalyticsModule } from "./analytics/analytics.service";
import { RecommendationsModule } from "./recommendations/recommendations.service";
import { CacheModule } from "./cache/cache.service";
import { HealthModule } from "./health/health.controller";
import { MaintenanceModule } from "./maintenance/maintenance.service";
import { SourcesModule } from "./sources/sources.module";
import { GenresModule } from "./genres/genres";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), PrismaModule, CacheModule, HealthModule, MaintenanceModule, MailModule, AuthModule, ComicsModule, ChaptersModule, AdminModule, NotificationsModule, ReviewsModule, NovelsModule, CreatorModule, BillingModule, AnalyticsModule, RecommendationsModule, SourcesModule, GenresModule],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule {}
