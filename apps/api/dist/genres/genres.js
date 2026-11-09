"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenresModule = exports.GenresController = exports.GenresService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/auth.guard");
const util_1 = require("../common/util");
const genre_dto_1 = require("./dto/genre.dto");
let GenresService = class GenresService {
    db;
    constructor(db) {
        this.db = db;
    }
    list() { return this.db.genre.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { comics: true } } } }); }
    create(d) { return this.db.genre.create({ data: { name: d.name.trim(), slug: (0, util_1.slugify)(d.name) } }); }
    update(id, d) { return this.db.genre.update({ where: { id }, data: { name: d.name.trim(), slug: (0, util_1.slugify)(d.name) } }); }
    async remove(id) {
        const r = await this.db.genre.deleteMany({ where: { id } });
        if (!r.count)
            throw new common_1.NotFoundException("Genre not found.");
    }
};
exports.GenresService = GenresService;
exports.GenresService = GenresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GenresService);
let GenresController = class GenresController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    list() { return this.svc.list(); }
    create(d) { return this.svc.create(d); }
    update(id, d) { return this.svc.update(id, d); }
    remove(id) { return this.svc.remove(id); }
};
exports.GenresController = GenresController;
__decorate([
    (0, common_1.Get)("genres"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GenresController.prototype, "list", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Post)("admin/genres"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [genre_dto_1.GenreDto]),
    __metadata("design:returntype", void 0)
], GenresController.prototype, "create", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.Put)("admin/genres/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, genre_dto_1.GenreDto]),
    __metadata("design:returntype", void 0)
], GenresController.prototype, "update", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("comic:write"),
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)("admin/genres/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GenresController.prototype, "remove", null);
exports.GenresController = GenresController = __decorate([
    (0, swagger_1.ApiTags)("genres"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [GenresService])
], GenresController);
let GenresModule = class GenresModule {
};
exports.GenresModule = GenresModule;
exports.GenresModule = GenresModule = __decorate([
    (0, common_1.Module)({ controllers: [GenresController], providers: [GenresService] })
], GenresModule);
//# sourceMappingURL=genres.js.map