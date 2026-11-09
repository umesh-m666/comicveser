import { PublishState, UserStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Min } from "class-validator";

export class AdminListQuery {
  @IsOptional() @IsString() @Length(1, 100) q?: string;
  @IsOptional() @IsEnum(PublishState) state?: PublishState;
  @IsOptional() @IsString() @Length(10, 40) comicId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
}
export class SetStatusDto { @IsEnum(UserStatus) status: UserStatus; }
export class ResolveReportDto { @IsIn(["RESOLVED", "DISMISSED"]) status: "RESOLVED" | "DISMISSED"; }
export class AnnouncementDto {
  @IsString() @Length(1, 200) title: string;
  @IsString() @Length(1, 2000) body: string;
  @IsOptional() @IsDateString() publishAt?: string;
}
export class CreatorStatusDto { @IsIn(["APPROVED", "REJECTED", "SUSPENDED"]) status: "APPROVED" | "REJECTED" | "SUSPENDED"; }
