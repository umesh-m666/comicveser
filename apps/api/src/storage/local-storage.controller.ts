import { BadRequestException, Controller, Get, Headers, HttpCode, Param, Put, Query, Req, Res } from "@nestjs/common";
import { SkipOrigin } from "../auth/auth.guard";
import type { Request, Response } from "express";
import { StorageService } from "./storage.service";

const SAFE_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

@Controller()
export class LocalStorageController {
  constructor(private storage: StorageService) {}

  @SkipOrigin()
  @Put("local-uploads/:token")
  @HttpCode(204)
  upload(
    @Param("token") token: string,
    @Headers("content-type") contentType: string,
    @Req() request: Request,
  ) {
    if (!token || !SAFE_TOKEN_RE.test(token)) {
      throw new BadRequestException("Invalid upload token.");
    }
    return this.storage.acceptLocalUpload(token, contentType, request.body as Buffer);
  }

  @Get("media")
  async media(@Query("key") key: string, @Res() response: Response) {
    const { body, mime } = await this.storage.readLocalFile(key);
    response.setHeader("Content-Type", mime);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cross-Origin-Resource-Policy", "same-site");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    response.setHeader("Cache-Control", "private, max-age=3600, no-transform");
    return response.send(body);
  }
}
