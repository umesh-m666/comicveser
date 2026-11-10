import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { Authenticated, AuthUser, CurrentUser, SESSION_COOKIE } from "./auth.guard";
import { ForgotDto, GoogleAuthDto, LoginDto, RegisterDto, ResetDto, VerifyDto } from "./dto/auth.dto";
import { sessionCookieOptions } from "../common/config";

const strict = { default: { limit: 10, ttl: 60_000 } };

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private svc: AuthService) {}

  @Get("config")
  config() {
    return this.svc.getAuthConfig();
  }

  @Throttle(strict)
  @Post("register")
  register(@Body() d: RegisterDto) {
    return this.svc.register(d);
  }

  @Throttle(strict)
  @HttpCode(200)
  @Post("login")
  async login(@Body() d: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, maxAgeMs, user } = await this.svc.login(d, req.headers["user-agent"]);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req, maxAgeMs));
    return { ok: true, token, user };
  }

  @Throttle(strict)
  @HttpCode(200)
  @Post("google")
  async google(@Body() d: GoogleAuthDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, maxAgeMs, user, isNewUser } = await this.svc.googleLogin(d, req.headers["user-agent"]);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req, maxAgeMs));
    return { ok: true, token, user, isNewUser };
  }

  @Authenticated()
  @HttpCode(204)
  @Post("logout")
  async logout(@CurrentUser() u: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.svc.logout(u.sessionId);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(req));
  }

  @Authenticated()
  @Get("me")
  me(@CurrentUser() { sessionId, ...u }: AuthUser) {
    return u;
  }

  @Throttle(strict)
  @HttpCode(204)
  @Post("verify-email")
  verify(@Body() d: VerifyDto) {
    return this.svc.verifyEmail(d.token);
  }

  @Throttle(strict)
  @HttpCode(200)
  @Post("forgot-password")
  async forgot(@Body() d: ForgotDto) {
    await this.svc.forgot(d.email);
    return { ok: true };
  }

  @Throttle(strict)
  @HttpCode(204)
  @Post("reset-password")
  reset(@Body() d: ResetDto) {
    return this.svc.reset(d.token, d.password);
  }
}
