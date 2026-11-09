"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const config_1 = require("./common/config");
const errors_1 = require("./common/errors");
async function bootstrap() {
    (0, config_1.assertProductionConfig)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    const instance = app.getHttpAdapter().getInstance();
    const proxy = process.env.TRUST_PROXY; // e.g. "1" behind one load balancer, so rate limits see real client IPs
    if (proxy)
        instance.set("trust proxy", /^\d+$/.test(proxy) ? Number(proxy) : proxy);
    app.useBodyParser("json", { limit: "1mb" }); // novel chapters can exceed the 100 KB default
    app.use(express_1.default.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/avif"], limit: "10mb" }));
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    app.use((0, cookie_parser_1.default)());
    app.setGlobalPrefix("api");
    app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new errors_1.AllExceptionsFilter());
    app.enableShutdownHooks();
    if (process.env.NODE_ENV !== "production") {
        swagger_1.SwaggerModule.setup("api/docs", app, swagger_1.SwaggerModule.createDocument(app, new swagger_1.DocumentBuilder().setTitle("ComicVerse API").setVersion("1.0").build()));
    }
    await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
//# sourceMappingURL=main.js.map