import { OmitType, PartialType } from "@nestjs/mapped-types";
import { PublishState } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min, ValidateNested } from "class-validator";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "../../storage/storage.service";

export class CreateChapterDto {
  @IsString() @Length(10, 40) comicId: string;
  @IsNumber() @Min(0) @Max(100000) number: number;
  @IsString() @Length(1, 200) title: string;
  @IsOptional() @IsEnum(PublishState) publishState?: PublishState;
  @IsOptional() @IsDateString() scheduledAt?: string;
}
export class UpdateChapterDto extends PartialType(OmitType(CreateChapterDto, ["comicId", "number"] as const)) {}

export class UploadUrlDto {
  @IsString() @Length(10, 40) chapterId: string;
  @IsIn(Object.keys(IMAGE_TYPES)) contentType: string;
  @IsInt() @Min(1) @Max(MAX_IMAGE_BYTES) size: number;
}
class ImageItem {
  @IsString() @Length(1, 200) key: string;
  @IsInt() @Min(1) @Max(20000) width: number;
  @IsInt() @Min(1) @Max(60000) height: number;
}
export class RegisterImagesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ImageItem) items: ImageItem[];
}
export class ReorderDto { @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) ids: string[]; }
export class ImagesQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) from: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) limit: number = 10;
}
