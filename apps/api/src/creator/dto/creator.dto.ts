import { OmitType } from "@nestjs/mapped-types";
import { IsOptional, IsString, Length } from "class-validator";
import { CreateComicDto } from "../../comics/dto/comic.dto";
import { CreateChapterDto } from "../../chapters/dto/chapter.dto";

export class ApplyDto { @IsString() @Length(2, 80) displayName: string; }
export class CreatorComicDto extends OmitType(CreateComicDto, ["publishState"] as const) {
  @IsString() @Length(1, 200) licenseHolder: string;
  @IsString() @Length(1, 100) licenseType: string;
  @IsOptional() @IsString() @Length(1, 100) territory?: string;
}
export class CreatorChapterDto extends OmitType(CreateChapterDto, ["comicId", "publishState", "scheduledAt"] as const) {}
