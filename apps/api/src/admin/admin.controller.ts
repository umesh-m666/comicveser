import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, RequireAdmin, RequirePermission } from "../auth/auth.guard";
import { AdminService } from "./admin.service";
import {
  AdminListQuery,
  AnnouncementDto,
  CreatorStatusDto,
  ResolveReportDto,
  SetStatusDto,
} from "./dto/admin.dto";

@ApiTags("admin")
@Controller()
export class AdminController {
  constructor(private svc: AdminService) {}

  @RequirePermission("audit:read")
  @Get("admin/dashboard")
  dashboard() {
    return this.svc.dashboard();
  }

  @RequireAdmin()
  @Get("admin/notifications")
  adminNotifications(
    @CurrentUser() u: AuthUser,
    @Query("filter") filter?: "all" | "published" | "failed" | "weebcentral" | "asurascans",
    @Query("page") page?: string,
  ) {
    return this.svc.adminNotifications(u.id, { filter, page: page ? Number.parseInt(page, 10) || 1 : 1 });
  }

  @RequirePermission("comic:write")
  @Get("admin/comics")
  comics(@Query() q: AdminListQuery) {
    return this.svc.comics(q);
  }

  @RequirePermission("comic:write")
  @Get("admin/comics/:id")
  comic(@Param("id") id: string) {
    return this.svc.comic(id);
  }

  @RequirePermission("chapter:write")
  @Get("admin/chapters")
  chapters(@Query() q: AdminListQuery) {
    return this.svc.chapters(q.comicId);
  }

  @RequirePermission("chapter:write")
  @Get("admin/chapters/:id")
  chapter(@Param("id") id: string) {
    return this.svc.chapter(id);
  }

  @RequirePermission("chapter:write")
  @HttpCode(204)
  @Delete("admin/chapters/:id/images/:imageId")
  deleteImage(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("imageId") imageId: string) {
    return this.svc.deleteImage(id, imageId, u.id);
  }

  @RequirePermission("chapter:write")
  @Post("admin/chapters/:id/bulk")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024, files: 1 } }))
  bulk(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @UploadedFile() file?: { buffer: Buffer; size: number },
  ) {
    return this.svc.bulkZip(id, file, u.id);
  }

  @RequirePermission("user:manage")
  @Get("admin/users")
  users(@Query() q: AdminListQuery) {
    return this.svc.users(q);
  }

  @RequirePermission("user:manage")
  @HttpCode(204)
  @Put("admin/users/:id/status")
  status(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: SetStatusDto) {
    return this.svc.setUserStatus(id, d.status, u.id);
  }

  @RequirePermission("review:moderate")
  @Get("admin/reports")
  reports(@Query() q: AdminListQuery) {
    return this.svc.reports(q);
  }

  @RequirePermission("review:moderate")
  @Put("admin/reports/:id")
  resolve(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: ResolveReportDto) {
    return this.svc.resolveReport(id, d, u.id);
  }

  @RequirePermission("audit:read")
  @Get("admin/audit-logs")
  audit(@Query() q: AdminListQuery) {
    return this.svc.auditLogs(q.page);
  }

  @RequirePermission("comic:write")
  @Get("admin/announcements")
  announcements() {
    return this.svc.announcements();
  }

  @RequirePermission("comic:write")
  @Post("admin/announcements")
  createAnn(@CurrentUser() u: AuthUser, @Body() d: AnnouncementDto) {
    return this.svc.createAnnouncement(d, u.id);
  }

  @RequirePermission("comic:write")
  @HttpCode(204)
  @Delete("admin/announcements/:id")
  deleteAnn(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    return this.svc.deleteAnnouncement(id, u.id);
  }

  @RequirePermission("user:manage")
  @Get("admin/creators")
  creators() {
    return this.svc.creators();
  }

  @RequirePermission("user:manage")
  @HttpCode(204)
  @Put("admin/creators/:id")
  creatorStatus(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: CreatorStatusDto) {
    return this.svc.setCreatorStatus(id, d.status, u.id);
  }

  @RequirePermission("review:moderate")
  @Get("admin/reviews")
  reviews(@Query() q: AdminListQuery) {
    return this.svc.reviews(q.page);
  }

  @Get("announcements")
  publicAnnouncements() {
    return this.svc.publicAnnouncements();
  }
}
