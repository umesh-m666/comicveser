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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const storage_service_1 = require("./storage.service");
let LocalStorageController = class LocalStorageController {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    upload(token, contentType, request) {
        return this.storage.acceptLocalUpload(token, contentType, request.body);
    }
    async media(key, response) {
        const { body, mime } = await this.storage.readLocalFile(key);
        response.setHeader("Content-Type", mime);
        response.setHeader("Cache-Control", "public, max-age=3600");
        return response.send(body);
    }
};
exports.LocalStorageController = LocalStorageController;
__decorate([
    (0, auth_guard_1.SkipOrigin)(),
    (0, common_1.Put)("local-uploads/:token"),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)("token")),
    __param(1, (0, common_1.Headers)("content-type")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], LocalStorageController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)("media"),
    __param(0, (0, common_1.Query)("key")),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LocalStorageController.prototype, "media", null);
exports.LocalStorageController = LocalStorageController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [typeof (_a = typeof storage_service_1.StorageService !== "undefined" && storage_service_1.StorageService) === "function" ? _a : Object])
], LocalStorageController);
