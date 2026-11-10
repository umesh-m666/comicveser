"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
// Every error leaves the API as { error: { statusCode, message, details? } } with no stack traces.
let AllExceptionsFilter = class AllExceptionsFilter {
    log = new common_1.Logger("Errors");
    catch(e, host) {
        const res = host.switchToHttp().getResponse();
        let statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR, message = "Something went wrong on our side.", details;
        if (e instanceof common_1.HttpException) {
            statusCode = e.getStatus();
            const r = e.getResponse();
            message = typeof r === "string" ? r : Array.isArray(r.message) ? "Validation failed" : r.message ?? e.message;
            if (Array.isArray(r?.message))
                details = r.message;
        }
        else if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (e.code === "P2002") {
                statusCode = 409;
                message = "A record with the same unique value already exists.";
            }
            else if (e.code === "P2025") {
                statusCode = 404;
                message = "Record not found.";
            }
            else
                this.log.error(e.message);
        }
        else
            this.log.error(e instanceof Error ? e.stack : String(e));
        res.status(statusCode).json({ error: { statusCode, message, ...(details ? { details } : {}) } });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
