import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UserController } from "../user/user.controller";
import { UserService } from "../user/user.service";
@Module({ controllers: [AuthController, UserController], providers: [AuthService, UserService] })
export class AuthModule {}
