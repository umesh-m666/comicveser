import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Authenticated, AuthUser, CurrentUser } from "../auth/auth.guard";
import { UserService } from "./user.service";
import { BookmarkDto, BookmarkQuery, BookmarkStatusDto, ChangePasswordDto, DeleteAccountDto, ProgressDto, UpdateProfileDto } from "./dto/user.dto";

@ApiTags("user")
@Authenticated()
@Controller("user")
export class UserController {
  constructor(private svc: UserService) {}
  @Get("profile") profile(@CurrentUser() u: AuthUser) { return this.svc.profile(u.id); }
  @Put("profile") update(@CurrentUser() u: AuthUser, @Body() d: UpdateProfileDto) { return this.svc.updateProfile(u.id, d); }
  @HttpCode(204) @Put("password") password(@CurrentUser() u: AuthUser, @Body() d: ChangePasswordDto) { return this.svc.changePassword(u.id, u.sessionId, d); }
  @Get("bookmarks") bookmarks(@CurrentUser() u: AuthUser, @Query() q: BookmarkQuery) { return this.svc.bookmarks(u.id, q); }
  @Get("bookmarks/:comicId") isBookmarked(@CurrentUser() u: AuthUser, @Param("comicId") id: string) { return this.svc.isBookmarked(u.id, id); }
  @HttpCode(204) @Post("bookmarks") add(@CurrentUser() u: AuthUser, @Body() d: BookmarkDto) { return this.svc.addBookmark(u.id, d.comicId); }
  @HttpCode(204) @Delete("bookmarks/:comicId") remove(@CurrentUser() u: AuthUser, @Param("comicId") id: string) { return this.svc.removeBookmark(u.id, id); }
  @HttpCode(204) @Put("bookmarks/:comicId/status") setStatus(@CurrentUser() u: AuthUser, @Param("comicId") id: string, @Body() d: BookmarkStatusDto) { return this.svc.setBookmarkStatus(u.id, id, d.status); }
  @HttpCode(204) @Post("progress") progress(@CurrentUser() u: AuthUser, @Body() d: ProgressDto) { return this.svc.saveProgress(u.id, d); }
  @Get("reviews") reviews(@CurrentUser() u: AuthUser) { return this.svc.reviews(u.id); }
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(204) @Delete("account") deleteAccount(@CurrentUser() u: AuthUser, @Body() d: DeleteAccountDto) { return this.svc.deleteAccount(u.id, d.password); }
  /** Marks a chapter as finished (persists the purple "read" state). The reader calls this once the chapter is completed. */
  @HttpCode(204) @Post("chapters/:chapterId/read") markRead(@CurrentUser() u: AuthUser, @Param("chapterId") id: string) { return this.svc.markChapterRead(u.id, id); }
  @Get("comics/:comicId/read-chapters") readChapterIds(@CurrentUser() u: AuthUser, @Param("comicId") id: string) { return this.svc.readChapterIds(u.id, id); }
  @Get("read-chapters") readChapters(@CurrentUser() u: AuthUser) { return this.svc.readChapters(u.id); }
  @Get("stats") stats(@CurrentUser() u: AuthUser) { return this.svc.stats(u.id); }
  @Get("history") history(@CurrentUser() u: AuthUser) { return this.svc.history(u.id); }
}
