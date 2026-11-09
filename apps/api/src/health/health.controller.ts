import { Controller, Get, Module, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private db: PrismaService) {}
  /** For uptime monitors and load balancers. Confirms the process is up and the database answers. */
  @Get("health") async health() {
    try { await this.db.$queryRaw`SELECT 1`; } catch { throw new ServiceUnavailableException("Database unavailable."); }
    return { status: "ok", uptimeSeconds: Math.round(process.uptime()) };
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
