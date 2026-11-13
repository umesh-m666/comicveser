import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { StorageService } from "../storage/storage.service";
import { SourcesModule } from "../sources/sources.module";

@Module({
  imports: [SourcesModule],
  controllers: [AdminController],
  providers: [AdminService, StorageService],
  exports: [AdminService],
})
export class AdminModule {}
