import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";

// Every error leaves the API as { error: { statusCode, message, details? } } with no stack traces.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private log = new Logger("Errors");
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR, message: string = "Something went wrong on our side.", details: unknown;

    if (e instanceof HttpException) {
      statusCode = e.getStatus();
      const r = e.getResponse() as any;
      message = typeof r === "string" ? r : Array.isArray(r.message) ? "Validation failed" : r.message ?? e.message;
      if (Array.isArray(r?.message)) details = r.message;
    } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") { statusCode = 409; message = "A record with the same unique value already exists."; }
      else if (e.code === "P2025") { statusCode = 404; message = "Record not found."; }
      else this.log.error(e.message);
    } else this.log.error(e instanceof Error ? e.stack : String(e));

    res.status(statusCode).json({ error: { statusCode, message, ...(details ? { details } : {}) } });
  }
}
