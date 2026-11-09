import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";

const LANG = /^[a-z]{2,3}(-[a-z]{2,4})?$/i;
export class SearchSourcesQuery {
  @IsOptional() @IsString() @Length(0, 100) q: string = "";
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]{2,30}$/) source: string = "weebcentral";
  @IsOptional() @IsIn(["manga", "manhwa", "manhua", "webtoon", "novel"]) type?: "manga" | "manhwa" | "manhua" | "webtoon" | "novel";
  @IsOptional() @Matches(LANG) language?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) limit: number = 20;
}
export class ChaptersQuery {
  @IsOptional() @Matches(LANG) language: string = "en";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit: number = 100;
}
export class PagesQuery { @IsOptional() @IsIn(["data", "data-saver"]) quality: "data" | "data-saver" = "data"; }
export class SaveExternalDto {
  @IsString() @Matches(/^[a-z0-9-]{2,30}$/) sourceId: string;
  @IsString() @Length(8, 80) externalId: string;
}
export class UpdateSourceDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @Length(1, 60) displayName?: string;
}
export class SourceTitleActionDto {
  @IsOptional() @Matches(LANG) language?: string;
  @IsOptional() @IsString() @Length(1, 500) note?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]{2,30}$/) chapterSourceId?: string;
  @IsOptional() @IsString() @Length(1, 120) chapterExternalId?: string;
}
export class ImportAlternativeChaptersDto {
  @IsString() @Matches(/^[a-z0-9-]{2,30}$/) sourceId: string;
  @IsString() @Length(1, 120) externalId: string;
  @IsOptional() @Matches(LANG) language: string = "en";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit: number = 500;
}
