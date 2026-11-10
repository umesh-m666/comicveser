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
exports.DeleteAccountDto = exports.BookmarkStatusDto = exports.BookmarkQuery = exports.ChangePasswordDto = exports.UpdateProfileDto = exports.ProgressDto = exports.BookmarkDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const bookmark_status_1 = require("../bookmark-status");
class BookmarkDto {
    comicId;
}
exports.BookmarkDto = BookmarkDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], BookmarkDto.prototype, "comicId", void 0);
class ProgressDto {
    comicId;
    chapterId;
    imageIndex;
    scrollY;
}
exports.ProgressDto = ProgressDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], ProgressDto.prototype, "comicId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 40),
    __metadata("design:type", String)
], ProgressDto.prototype, "chapterId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(5000),
    __metadata("design:type", Number)
], ProgressDto.prototype, "imageIndex", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(10_000_000),
    __metadata("design:type", Number)
], ProgressDto.prototype, "scrollY", void 0);
class UpdateProfileDto {
    username;
    bio;
}
exports.UpdateProfileDto = UpdateProfileDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9_]{3,30}$/, { message: "Username must be 3-30 letters, numbers or underscores" }),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "username", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 500),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "bio", void 0);
class ChangePasswordDto {
    current;
    next;
}
exports.ChangePasswordDto = ChangePasswordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 128),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "current", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 128),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "next", void 0);
class BookmarkQuery {
    q;
    /** updated = recently updated, added = recently added, title = A-Z ("recent" is the legacy name for added). */
    sort;
    /** One shelf, or omitted / "ALL" for everything. */
    status;
    page = 1;
    limit = 24;
}
exports.BookmarkQuery = BookmarkQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], BookmarkQuery.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(bookmark_status_1.BOOKMARK_SORTS),
    __metadata("design:type", String)
], BookmarkQuery.prototype, "sort", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...bookmark_status_1.BOOKMARK_STATUSES, "ALL"]),
    __metadata("design:type", String)
], BookmarkQuery.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], BookmarkQuery.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(60),
    __metadata("design:type", Number)
], BookmarkQuery.prototype, "limit", void 0);
class BookmarkStatusDto {
    /** A shelf, or AUTO to go back to the automatic status. */
    status;
}
exports.BookmarkStatusDto = BookmarkStatusDto;
__decorate([
    (0, class_validator_1.IsIn)([...bookmark_status_1.BOOKMARK_STATUSES, "AUTO"]),
    __metadata("design:type", String)
], BookmarkStatusDto.prototype, "status", void 0);
class DeleteAccountDto {
    password;
}
exports.DeleteAccountDto = DeleteAccountDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 128),
    __metadata("design:type", String)
], DeleteAccountDto.prototype, "password", void 0);
//# sourceMappingURL=user.dto.js.map