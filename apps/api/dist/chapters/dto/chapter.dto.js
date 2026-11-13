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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImagesQuery = exports.ReorderDto = exports.RegisterImagesDto = exports.UploadUrlDto = exports.UpdateChapterDto = exports.CreateChapterDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const storage_service_1 = require("../../storage/storage.service");
class CreateChapterDto {
    comicId;
    number;
    title;
    publishState;
    scheduledAt;
}
exports.CreateChapterDto = CreateChapterDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], CreateChapterDto.prototype, "comicId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100000),
    __metadata("design:type", Number)
], CreateChapterDto.prototype, "number", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], CreateChapterDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PublishState),
    __metadata("design:type", typeof (_a = typeof client_1.PublishState !== "undefined" && client_1.PublishState) === "function" ? _a : Object)
], CreateChapterDto.prototype, "publishState", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateChapterDto.prototype, "scheduledAt", void 0);
class UpdateChapterDto extends (0, mapped_types_1.PartialType)((0, mapped_types_1.OmitType)(CreateChapterDto, ["comicId", "number"])) {
}
exports.UpdateChapterDto = UpdateChapterDto;
class UploadUrlDto {
    chapterId;
    contentType;
    size;
}
exports.UploadUrlDto = UploadUrlDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], UploadUrlDto.prototype, "chapterId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(Object.keys(storage_service_1.IMAGE_TYPES)),
    __metadata("design:type", String)
], UploadUrlDto.prototype, "contentType", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(storage_service_1.MAX_IMAGE_BYTES),
    __metadata("design:type", Number)
], UploadUrlDto.prototype, "size", void 0);
class ImageItem {
    key;
    width;
    height;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], ImageItem.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20000),
    __metadata("design:type", Number)
], ImageItem.prototype, "width", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(60000),
    __metadata("design:type", Number)
], ImageItem.prototype, "height", void 0);
class RegisterImagesDto {
    items;
}
exports.RegisterImagesDto = RegisterImagesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ImageItem),
    __metadata("design:type", Array)
], RegisterImagesDto.prototype, "items", void 0);
class ReorderDto {
    ids;
}
exports.ReorderDto = ReorderDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ReorderDto.prototype, "ids", void 0);
class ImagesQuery {
    from = 0;
    limit = 10;
}
exports.ImagesQuery = ImagesQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ImagesQuery.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(30),
    __metadata("design:type", Number)
], ImagesQuery.prototype, "limit", void 0);
