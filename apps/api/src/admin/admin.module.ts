import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { StorageService } from "../storage/storage.service";
@Module({ controllers: [AdminController], providers: [AdminService, StorageService], exports: [AdminService] })
export class AdminModule {}
