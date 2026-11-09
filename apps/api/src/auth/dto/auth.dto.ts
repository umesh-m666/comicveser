import { IsEmail, IsString, Length, Matches } from "class-validator";
export class RegisterDto {
  @Matches(/^[a-zA-Z0-9_]{3,30}$/, { message: "Username must be 3-30 letters, numbers or underscores" }) username: string;
  @IsEmail() @Length(3, 254) email: string;
  @IsString() @Length(10, 128) password: string;
  @IsString() confirmPassword: string;
}
export class LoginDto { @IsEmail() email: string; @IsString() @Length(1, 128) password: string; }
export class ForgotDto { @IsEmail() email: string; }
export class ResetDto { @IsString() @Length(20, 100) token: string; @IsString() @Length(10, 128) password: string; }
export class VerifyDto { @IsString() @Length(20, 100) token: string; }
