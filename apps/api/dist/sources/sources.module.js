"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourcesModule = void 0;
exports.createSourceProviders = createSourceProviders;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const asurascans_provider_1 = require("./asurascans.provider");
const sources_controller_1 = require("./sources.controller");
const sources_service_1 = require("./sources.service");
const sources_config_1 = require("./sources.config");
const comick_provider_1 = require("./comick.provider");
const weebcentral_provider_1 = require("./weebcentral.provider");
function createSourceProviders(config) {
    return config.enabled
        ? [new weebcentral_provider_1.WeebCentralProvider(config), new asurascans_provider_1.AsuraScansProvider(config), new comick_provider_1.ComicKProvider(config)]
        : [];
}
let SourcesModule = class SourcesModule {
};
exports.SourcesModule = SourcesModule;
exports.SourcesModule = SourcesModule = __decorate([
    (0, common_1.Module)({
        controllers: [sources_controller_1.SourcesController],
        providers: [
            { provide: sources_service_1.SOURCES_CONFIG, useFactory: () => (0, sources_config_1.loadSourcesConfig)() }, // throws at start-up if enabled with bad settings
            { provide: sources_service_1.SOURCE_PROVIDERS, useFactory: createSourceProviders, inject: [sources_service_1.SOURCES_CONFIG] },
            auth_guard_1.SessionGuard, auth_guard_1.PermissionGuard, auth_guard_1.AdminRoleGuard,
            sources_service_1.SourcesService,
        ],
        exports: [sources_service_1.SourcesService],
    })
], SourcesModule);
