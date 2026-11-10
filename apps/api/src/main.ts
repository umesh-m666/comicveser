import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { assertProductionConfig, isOriginAllowed, isProd } from "./common/config";
import { AllExceptionsFilter } from "./common/errors";
import { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  assertProductionConfig();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    { rawBody: true },
  );
  const instance = app.getHttpAdapter().getInstance();
  const proxy = process.env.TRUST_PROXY ?? (isProd() ? "1" : undefined);
  if (proxy) instance.set("trust proxy", /^\d+$/.test(proxy) ? Number(proxy) : proxy);

  app.useBodyParser("json", { limit: "1mb" }); // novel chapters can exceed the 100 KB default
  app.use(express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/avif"], limit: "10mb" }));
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      contentSecurityPolicy: {
        useDefaults: true,
        reportOnly: true,
        directives: {
          defaultSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    exposedHeaders: ["Set-Cookie"],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("ComicVerse API").setVersion("1.0").build()),
    );
  }
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
