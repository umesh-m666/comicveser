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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorChapterDto = exports.CreatorComicDto = exports.ApplyDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const class_validator_1 = require("class-validator");
const comic_dto_1 = require("../../comics/dto/comic.dto");
const chapter_dto_1 = require("../../chapters/dto/chapter.dto");
class ApplyDto {
    displayName;
}
exports.ApplyDto = ApplyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 80),
    __metadata("design:type", String)
], ApplyDto.prototype, "displayName", void 0);
class CreatorComicDto extends (0, mapped_types_1.OmitType)(comic_dto_1.CreateComicDto, ["publishState"]) {
    licenseHolder;
    licenseType;
    territory;
}
exports.CreatorComicDto = CreatorComicDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], CreatorComicDto.prototype, "licenseHolder", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], CreatorComicDto.prototype, "licenseType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], CreatorComicDto.prototype, "territory", void 0);
class CreatorChapterDto extends (0, mapped_types_1.OmitType)(chapter_dto_1.CreateChapterDto, ["comicId", "publishState", "scheduledAt"]) {
}
exports.CreatorChapterDto = CreatorChapterDto;
//# sourceMappingURL=creator.dto.js.map