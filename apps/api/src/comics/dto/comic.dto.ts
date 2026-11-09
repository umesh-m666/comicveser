import { ComicStatus, ComicType, PublishState } from "@prisma/client";
import { PartialType } from "@nestjs/mapped-types";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class CreateComicDto {
  @IsString() @Length(1, 200) title: string;
  @IsOptional() @IsString() @Length(1, 200) altTitle?: string;
  @IsString() @Length(1, 5000) description: string;
  @IsString() @Length(1, 120) author: string;
  @IsString() @Length(1, 120) artist: string;
  @IsEnum(ComicType) type: ComicType;
  @IsOptional() @IsEnum(ComicStatus) status?: ComicStatus;
  @IsOptional() @IsEnum(PublishState) publishState?: PublishState;
  @IsInt() @Min(1900) @Max(2100) releaseYear: number;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) genreSlugs: string[];
  @IsOptional() @IsString() @Length(1, 300) coverKey?: string;
  @IsOptional() @IsString() @Length(1, 300) bannerKey?: string;
}
export class UpdateComicDto extends PartialType(CreateComicDto) {}

export class ListComicsQuery {
  @IsOptional() @IsString() @Length(1, 100) q?: string;
  @IsOptional() @IsString() genre?: string;
  @IsOptional() @IsEnum(ComicType) type?: ComicType;
  @IsOptional() @IsEnum(ComicStatus) status?: ComicStatus;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(10) minRating?: number;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @IsEnum(["updated", "added", "popular", "alpha"]) sort?: "updated" | "added" | "popular" | "alpha";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize: number = 12;
}
