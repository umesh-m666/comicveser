import { Module } from "@nestjs/common";
import { AdminRoleGuard, PermissionGuard, SessionGuard } from "../auth/auth.guard";
import { AsuraScansProvider } from "./asurascans.provider";
import { SourcesController } from "./sources.controller";
import { SOURCE_PROVIDERS, SOURCES_CONFIG, SourcesService } from "./sources.service";
import { loadSourcesConfig, SourcesConfig } from "./sources.config";
import { ComicKProvider } from "./comick.provider";
import { WeebCentralProvider } from "./weebcentral.provider";
import type { MangaSourceProvider } from "./provider.interface";

export function createSourceProviders(config: SourcesConfig): MangaSourceProvider[] {
  return config.enabled
    ? [new WeebCentralProvider(config), new AsuraScansProvider(config), new ComicKProvider(config)]
    : [];
}

@Module({
  controllers: [SourcesController],
  providers: [
    { provide: SOURCES_CONFIG, useFactory: () => loadSourcesConfig() }, // throws at start-up if enabled with bad settings
    { provide: SOURCE_PROVIDERS, useFactory: createSourceProviders, inject: [SOURCES_CONFIG] },
    SessionGuard, PermissionGuard, AdminRoleGuard,
    SourcesService,
  ],
  exports: [SourcesService],
})
export class SourcesModule {}
