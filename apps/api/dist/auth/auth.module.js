"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const google_token_verifier_1 = require("./google-token.verifier");
const user_controller_1 = require("../user/user.controller");
const user_service_1 = require("../user/user.service");
const storage_service_1 = require("../storage/storage.service");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        controllers: [auth_controller_1.AuthController, user_controller_1.UserController],
        providers: [auth_service_1.AuthService, google_token_verifier_1.GoogleTokenVerifier, user_service_1.UserService, storage_service_1.StorageService],
        exports: [auth_service_1.AuthService, google_token_verifier_1.GoogleTokenVerifier],
    })
], AuthModule);
