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
exports.ImportAlternativeChaptersDto = exports.SourceTitleActionDto = exports.UpdateSourceDto = exports.SaveExternalDto = exports.PagesQuery = exports.ImportChaptersBodyDto = exports.LinkFallbackDto = exports.FallbackCandidatesQuery = exports.ComicChaptersQuery = exports.ChaptersQuery = exports.SearchSourcesQuery = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const LANG = /^[a-z]{2,3}(-[a-z]{2,4})?$/i;
class SearchSourcesQuery {
    q = "";
    source = "weebcentral";
    type;
    language;
    page = 1;
    limit = 20;
}
exports.SearchSourcesQuery = SearchSourcesQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 100),
    __metadata("design:type", String)
], SearchSourcesQuery.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9-]{2,30}$/),
    __metadata("design:type", String)
], SearchSourcesQuery.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["manga", "manhwa", "manhua", "webtoon", "novel"]),
    __metadata("design:type", String)
], SearchSourcesQuery.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(LANG),
    __metadata("design:type", String)
], SearchSourcesQuery.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10_000),
    __metadata("design:type", Number)
], SearchSourcesQuery.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(24),
    __metadata("design:type", Number)
], SearchSourcesQuery.prototype, "limit", void 0);
class ChaptersQuery {
    language = "en";
    page = 1;
    limit = 100;
}
exports.ChaptersQuery = ChaptersQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(LANG),
    __metadata("design:type", String)
], ChaptersQuery.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], ChaptersQuery.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], ChaptersQuery.prototype, "limit", void 0);
class ComicChaptersQuery extends ChaptersQuery {
    sourceId;
}
exports.ComicChaptersQuery = ComicChaptersQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9-]{2,30}$/),
    __metadata("design:type", String)
], ComicChaptersQuery.prototype, "sourceId", void 0);
class FallbackCandidatesQuery {
    q;
    sourceId;
    page = 1;
    limit = 12;
}
exports.FallbackCandidatesQuery = FallbackCandidatesQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 150),
    __metadata("design:type", String)
], FallbackCandidatesQuery.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["weebcentral", "asurascans"]),
    __metadata("design:type", String)
], FallbackCandidatesQuery.prototype, "sourceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], FallbackCandidatesQuery.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(24),
    __metadata("design:type", Number)
], FallbackCandidatesQuery.prototype, "limit", void 0);
class LinkFallbackDto {
    sourceId;
    externalId;
}
exports.LinkFallbackDto = LinkFallbackDto;
__decorate([
    (0, class_validator_1.IsIn)(["weebcentral", "asurascans"]),
    __metadata("design:type", String)
], LinkFallbackDto.prototype, "sourceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 150),
    __metadata("design:type", String)
], LinkFallbackDto.prototype, "externalId", void 0);
class ImportChaptersBodyDto {
    chapterIds;
}
exports.ImportChaptersBodyDto = ImportChaptersBodyDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ImportChaptersBodyDto.prototype, "chapterIds", void 0);
class PagesQuery {
    quality = "data";
}
exports.PagesQuery = PagesQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["data", "data-saver"]),
    __metadata("design:type", String)
], PagesQuery.prototype, "quality", void 0);
class SaveExternalDto {
    sourceId;
    externalId;
}
exports.SaveExternalDto = SaveExternalDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9-]{2,30}$/),
    __metadata("design:type", String)
], SaveExternalDto.prototype, "sourceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(8, 80),
    __metadata("design:type", String)
], SaveExternalDto.prototype, "externalId", void 0);
class UpdateSourceDto {
    enabled;
    displayName;
}
exports.UpdateSourceDto = UpdateSourceDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateSourceDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 60),
    __metadata("design:type", String)
], UpdateSourceDto.prototype, "displayName", void 0);
class SourceTitleActionDto {
    language;
    note;
    chapterSourceId;
    chapterExternalId;
}
exports.SourceTitleActionDto = SourceTitleActionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(LANG),
    __metadata("design:type", String)
], SourceTitleActionDto.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], SourceTitleActionDto.prototype, "note", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9-]{2,30}$/),
    __metadata("design:type", String)
], SourceTitleActionDto.prototype, "chapterSourceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    __metadata("design:type", String)
], SourceTitleActionDto.prototype, "chapterExternalId", void 0);
class ImportAlternativeChaptersDto {
    sourceId;
    externalId;
    language = "en";
    page = 1;
    limit = 500;
}
exports.ImportAlternativeChaptersDto = ImportAlternativeChaptersDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9-]{2,30}$/),
    __metadata("design:type", String)
], ImportAlternativeChaptersDto.prototype, "sourceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    __metadata("design:type", String)
], ImportAlternativeChaptersDto.prototype, "externalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(LANG),
    __metadata("design:type", String)
], ImportAlternativeChaptersDto.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], ImportAlternativeChaptersDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], ImportAlternativeChaptersDto.prototype, "limit", void 0);
