"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const prisma_service_1 = require("./prisma/prisma.service");
const comics_module_1 = require("./comics/comics.module");
const mail_service_1 = require("./mail/mail.service");
const auth_module_1 = require("./auth/auth.module");
const auth_guard_1 = require("./auth/auth.guard");
const chapters_module_1 = require("./chapters/chapters.module");
const admin_module_1 = require("./admin/admin.module");
const notifications_service_1 = require("./notifications/notifications.service");
const reviews_service_1 = require("./reviews/reviews.service");
const novels_service_1 = require("./novels/novels.service");
const creator_service_1 = require("./creator/creator.service");
const billing_service_1 = require("./billing/billing.service");
const analytics_service_1 = require("./analytics/analytics.service");
const recommendations_service_1 = require("./recommendations/recommendations.service");
const cache_service_1 = require("./cache/cache.service");
const health_controller_1 = require("./health/health.controller");
const maintenance_service_1 = require("./maintenance/maintenance.service");
const sources_module_1 = require("./sources/sources.module");
const genres_1 = require("./genres/genres");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), prisma_service_1.PrismaModule, cache_service_1.CacheModule, health_controller_1.HealthModule, maintenance_service_1.MaintenanceModule, mail_service_1.MailModule, auth_module_1.AuthModule, comics_module_1.ComicsModule, chapters_module_1.ChaptersModule, admin_module_1.AdminModule, notifications_service_1.NotificationsModule, reviews_service_1.ReviewsModule, novels_service_1.NovelsModule, creator_service_1.CreatorModule, billing_service_1.BillingModule, analytics_service_1.AnalyticsModule, recommendations_service_1.RecommendationsModule, sources_module_1.SourcesModule, genres_1.GenresModule],
        providers: [{ provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard }, { provide: core_1.APP_GUARD, useClass: auth_guard_1.OriginGuard }],
    })
], AppModule);
