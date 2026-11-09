import { Module } from "@nestjs/common";
import { ChaptersController } from "./chapters.controller";
import { ChaptersService } from "./chapters.service";
import { StorageService } from "../storage/storage.service";
import { LocalStorageController } from "../storage/local-storage.controller";
import { SourcesModule } from "../sources/sources.module";
@Module({ imports: [SourcesModule], controllers: [ChaptersController, LocalStorageController], providers: [ChaptersService, StorageService], exports: [ChaptersService] })
export class ChaptersModule {}
