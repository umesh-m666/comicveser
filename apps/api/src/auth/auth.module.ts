import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleTokenVerifier } from "./google-token.verifier";
import { UserController } from "../user/user.controller";
import { UserService } from "../user/user.service";
import { StorageService } from "../storage/storage.service";

@Global()
@Module({
  controllers: [AuthController, UserController],
  providers: [AuthService, GoogleTokenVerifier, UserService, StorageService],
  exports: [AuthService, GoogleTokenVerifier],
})
export class AuthModule {}
