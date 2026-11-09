import { Controller, Get, Headers, HttpCode, Param, Put, Query, Req, Res } from "@nestjs/common";
import { SkipOrigin } from "../auth/auth.guard";
import type { Request, Response } from "express";
import { StorageService } from "./storage.service";

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
    return this.storage.acceptLocalUpload(token, contentType, request.body as Buffer);
  }

  @Get("media")
  async media(@Query("key") key: string, @Res() response: Response) {
    const { body, mime } = await this.storage.readLocalFile(key);
    response.setHeader("Content-Type", mime);
    response.setHeader("Cache-Control", "public, max-age=3600");
    return response.send(body);
  }
}
