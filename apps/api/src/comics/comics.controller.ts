import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, RequirePermission } from "../auth/auth.guard";
import { ComicsService } from "./comics.service";
import { CreateComicDto, ListComicsQuery, UpdateComicDto } from "./dto/comic.dto";
import { IsInt, IsString, Max, Min } from "class-validator";
class ComicCoverUploadDto { @IsString() contentType: string; @IsInt() @Min(1) @Max(10 * 1024 * 1024) size: number; }

@ApiTags("comics")
@Controller()
export class ComicsController {
  constructor(private svc: ComicsService) {}

  // Static routes are declared before :slug so they are not captured by it.
  @Get("comics") list(@Query() q: ListComicsQuery) { return this.svc.list(q); }
  @Get("comics/trending") trending() { return this.svc.trending(); }
  @Get("comics/latest") latest() { return this.svc.latest(); }
  @Get("comics/popular") popular() { return this.svc.popular(); }
  @Get("comics/:id/chapters") chapters(@Param("id") id: string, @Query("order") order?: "asc" | "desc") {
    return this.svc.chapters(id, order === "asc" ? "asc" : "desc");
  }
  @Get("comics/:slug") one(@Param("slug") slug: string) { return this.svc.bySlug(slug); }
  @Get("search") search(@Query() q: ListComicsQuery) { return this.svc.list(q); }

  @RequirePermission("comic:write")
  @HttpCode(200) @Post("admin/comic-uploads") coverUpload(@Body() d: ComicCoverUploadDto) { return this.svc.coverUploadUrl(d.contentType, d.size); }

  @RequirePermission("comic:write")
  @Post("admin/comics") create(@CurrentUser() u: AuthUser, @Body() dto: CreateComicDto) { return this.svc.create(dto, u.id); }

  @RequirePermission("comic:write")
  @Put("admin/comics/:id") update(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: UpdateComicDto) { return this.svc.update(id, dto, u.id); }

  @RequirePermission("comic:write") @HttpCode(204)
  @Delete("admin/comics/:id") async remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { await this.svc.remove(id, u.id); }
}
