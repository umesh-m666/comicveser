import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { RequirePermission } from "../auth/auth.guard";
import { slugify } from "../common/util";
import { GenreDto } from "./dto/genre.dto";

@Injectable()
export class GenresService {
  constructor(private db: PrismaService) {}
  list() { return this.db.genre.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { comics: true } } } }); }
  create(d: GenreDto) { return this.db.genre.create({ data: { name: d.name.trim(), slug: slugify(d.name) } }); }
  update(id: string, d: GenreDto) { return this.db.genre.update({ where: { id }, data: { name: d.name.trim(), slug: slugify(d.name) } }); }
  async remove(id: string) {
    const r = await this.db.genre.deleteMany({ where: { id } });
    if (!r.count) throw new NotFoundException("Genre not found.");
  }
}

@ApiTags("genres")
@Controller()
export class GenresController {
  constructor(private svc: GenresService) {}
  @Get("genres") list() { return this.svc.list(); }
  @RequirePermission("comic:write") @Post("admin/genres") create(@Body() d: GenreDto) { return this.svc.create(d); }
  @RequirePermission("comic:write") @Put("admin/genres/:id") update(@Param("id") id: string, @Body() d: GenreDto) { return this.svc.update(id, d); }
  @RequirePermission("comic:write") @HttpCode(204) @Delete("admin/genres/:id") remove(@Param("id") id: string) { return this.svc.remove(id); }
}

@Module({ controllers: [GenresController], providers: [GenresService] })
export class GenresModule {}
