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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorStatusDto = exports.AnnouncementDto = exports.ResolveReportDto = exports.SetStatusDto = exports.AdminListQuery = void 0;
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class AdminListQuery {
    q;
    state;
    comicId;
    reportStatus;
    category;
    unreadOnly;
    page = 1;
}
exports.AdminListQuery = AdminListQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], AdminListQuery.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PublishState),
    __metadata("design:type", typeof (_a = typeof client_1.PublishState !== "undefined" && client_1.PublishState) === "function" ? _a : Object)
], AdminListQuery.prototype, "state", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], AdminListQuery.prototype, "comicId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["OPEN", "RESOLVED", "DISMISSED"]),
    __metadata("design:type", String)
], AdminListQuery.prototype, "reportStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 40),
    __metadata("design:type", String)
], AdminListQuery.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminListQuery.prototype, "unreadOnly", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminListQuery.prototype, "page", void 0);
class SetStatusDto {
    status;
}
exports.SetStatusDto = SetStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.UserStatus),
    __metadata("design:type", typeof (_b = typeof client_1.UserStatus !== "undefined" && client_1.UserStatus) === "function" ? _b : Object)
], SetStatusDto.prototype, "status", void 0);
class ResolveReportDto {
    status;
    adminResponse;
    isRead;
}
exports.ResolveReportDto = ResolveReportDto;
__decorate([
    (0, class_validator_1.IsIn)(["OPEN", "RESOLVED", "DISMISSED"]),
    __metadata("design:type", String)
], ResolveReportDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 2000),
    __metadata("design:type", String)
], ResolveReportDto.prototype, "adminResponse", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ResolveReportDto.prototype, "isRead", void 0);
class AnnouncementDto {
    title;
    body;
    publishAt;
}
exports.AnnouncementDto = AnnouncementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], AnnouncementDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 2000),
    __metadata("design:type", String)
], AnnouncementDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AnnouncementDto.prototype, "publishAt", void 0);
class CreatorStatusDto {
    status;
}
exports.CreatorStatusDto = CreatorStatusDto;
__decorate([
    (0, class_validator_1.IsIn)(["APPROVED", "REJECTED", "SUSPENDED"]),
    __metadata("design:type", String)
], CreatorStatusDto.prototype, "status", void 0);
