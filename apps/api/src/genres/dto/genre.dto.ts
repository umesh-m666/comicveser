import { IsString, Length } from "class-validator";
export class GenreDto { @IsString() @Length(1, 60) name: string; }
