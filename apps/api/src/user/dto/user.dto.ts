import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";
import { BOOKMARK_SORTS, BOOKMARK_STATUSES } from "../bookmark-status";
export class BookmarkDto { @IsString() @Length(10, 40) comicId: string; }
export class ProgressDto {
  @IsString() @Length(10, 40) comicId: string;
  @IsString() @Length(10, 40) chapterId: string;
  @IsInt() @Min(0) @Max(5000) imageIndex: number;
  @IsInt() @Min(0) @Max(10_000_000) scrollY: number;
}
export class UpdateProfileDto {
  @IsOptional() @Matches(/^[a-zA-Z0-9_]{3,30}$/, { message: "Username must be 3-30 letters, numbers or underscores" }) username?: string;
  @IsOptional() @IsString() @Length(0, 500) bio?: string;
}
export class ChangePasswordDto { @IsString() @Length(1, 128) current: string; @IsString() @Length(10, 128) next: string; }
export class BookmarkQuery {
  @IsOptional() @IsString() @Length(1, 100) q?: string;
  /** updated = recently updated, added = recently added, title = A-Z ("recent" is the legacy name for added). */
  @IsOptional() @IsIn(BOOKMARK_SORTS as unknown as string[]) sort?: string;
  /** One shelf, or omitted / "ALL" for everything. */
  @IsOptional() @IsIn([...BOOKMARK_STATUSES, "ALL"]) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) limit: number = 24;
}
export class BookmarkStatusDto {
  /** A shelf, or AUTO to go back to the automatic status. */
  @IsIn([...BOOKMARK_STATUSES, "AUTO"]) status: string;
}
export class DeleteAccountDto { @IsString() @Length(1, 128) password: string; }
