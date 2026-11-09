import { ComicStatus, PublishState } from "@prisma/client";
import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class CreateNovelDto {
  @IsString() @Length(1, 200) title: string;
  @IsString() @Length(1, 120) author: string;
  @IsString() @Length(1, 5000) description: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) genres: string[];
  @IsOptional() @IsEnum(ComicStatus) status?: ComicStatus;
  @IsOptional() @IsEnum(PublishState) publishState?: PublishState;
}
export class UpdateNovelDto extends PartialType(CreateNovelDto) {}
export class CreateNovelChapterDto {
  @IsNumber() @Min(0) @Max(100000) number: number;
  @IsString() @Length(1, 200) title: string;
  @IsString() @Length(1, 200000) body: string;
  @IsOptional() @IsEnum(PublishState) publishState?: PublishState;
}
export class UpdateNovelChapterDto {
  @IsOptional() @IsString() @Length(1, 200) title?: string;
  @IsOptional() @IsString() @Length(1, 200000) body?: string;
  @IsOptional() @IsEnum(PublishState) publishState?: PublishState;
}
export class NovelListQuery {
  @IsOptional() @IsString() @Length(1, 100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
}
