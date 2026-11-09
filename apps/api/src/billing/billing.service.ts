import { BadGatewayException, BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, Injectable, Logger, Module, NotFoundException, Param, Post, Put, RawBodyRequest, Req, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { Authenticated, AuthUser, CurrentUser, RequirePermission, SkipOrigin } from "../auth/auth.guard";

class CheckoutDto { @IsString() @Length(3, 40) planCode: string; }
class VerifyDto { @IsString() @Length(5, 60) orderId: string; @IsString() @Length(5, 60) paymentId: string; @IsString() @Length(10, 200) signature: string; }
class PlanDto {
  @IsOptional() @IsString() @Length(1, 80) name?: string;
  @IsOptional() @IsInt() @Min(100) @Max(10_000_000) priceMinor?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const safeEq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const hmac = (secret: string, data: string | Buffer) => createHmac("sha256", secret).update(data).digest("hex");
const ENTITLED = (now: Date) => ({ status: { in: ["ACTIVE", "CANCELED"] as ("ACTIVE" | "CANCELED")[] }, currentPeriodEnd: { gt: now } });

@Injectable()
export class BillingService {
  private log = new Logger("Billing");
  constructor(private db: PrismaService) {}
  private get enabled() { return process.env.PAYMENTS_ENABLED === "true" && !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET; }
  private need() { if (!this.enabled) throw new ServiceUnavailableException("Premium memberships are not available right now."); }

  private async rzp<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const r = await fetch(`https://api.razorpay.com/v1${path}`, { method: init.method ?? "GET", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: init.body ? JSON.stringify(init.body) : undefined });
    if (!r.ok) { this.log.error(`Razorpay ${path} -> ${r.status}`); throw new BadGatewayException("The payment provider returned an error. Please try again."); }
    return r.json() as Promise<T>;
  }

  async plans() {
    if ((await this.db.subscriptionPlan.count()) === 0)
      await this.db.subscriptionPlan.createMany({ skipDuplicates: true, data: [{ code: "premium_monthly", name: "Premium Monthly", priceMinor: 14900, intervalMonths: 1 }, { code: "premium_yearly", name: "Premium Yearly", priceMinor: 149900, intervalMonths: 12 }] });
    return { enabled: this.enabled, plans: await this.db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { priceMinor: "asc" }, select: { code: true, name: true, priceMinor: true, currency: true, intervalMonths: true } }) };
  }
  async status(userId: string) {
    const sub = await this.db.subscription.findFirst({ where: { userId, ...ENTITLED(new Date()) }, orderBy: { currentPeriodEnd: "desc" }, include: { plan: { select: { name: true } } } });
    return { premium: !!sub, until: sub?.currentPeriodEnd ?? null, plan: sub?.plan.name ?? null, canceled: sub?.status === "CANCELED" };
  }
  async history(userId: string) {
    const rows = await this.db.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map((p) => ({ id: p.id, invoiceNo: `INV-${p.createdAt.getFullYear()}-${p.id.slice(-8).toUpperCase()}`, planCode: p.planCode, amountMinor: p.amountMinor, currency: p.currency, status: p.status, createdAt: p.createdAt }));
  }

  async checkout(u: AuthUser, planCode: string) {
    this.need();
    if (!u.emailVerified) throw new ForbiddenException("Verify your email before subscribing.");
    const plan = await this.db.subscriptionPlan.findFirst({ where: { code: planCode, active: true } });
    if (!plan) throw new NotFoundException("Plan not found.");
    const order = await this.rzp<{ id: string }>("/orders", { method: "POST", body: { amount: plan.priceMinor, currency: plan.currency, receipt: `cv_${Date.now()}`, notes: { userId: u.id, planCode } } });
    await this.db.payment.create({ data: { userId: u.id, amountMinor: plan.priceMinor, currency: plan.currency, providerOrderId: order.id, planCode } });
    return { orderId: order.id, amount: plan.priceMinor, currency: plan.currency, keyId: process.env.RAZORPAY_KEY_ID, planName: plan.name };
  }

  /** Browser callback. The signature is checked with our secret and the payment is re-read from Razorpay; the browser's word alone is never enough. */
  async verify(u: AuthUser, d: VerifyDto) {
    this.need();
    if (!safeEq(hmac(process.env.RAZORPAY_KEY_SECRET!, `${d.orderId}|${d.paymentId}`), d.signature)) throw new BadRequestException("Payment signature is invalid.");
    const pay = await this.db.payment.findUnique({ where: { providerOrderId: d.orderId } });
    if (!pay || pay.userId !== u.id) throw new NotFoundException("Payment not found.");
    let info = await this.rzp<{ status: string; amount: number; order_id: string; currency: string }>(`/payments/${d.paymentId}`);
    if (info.order_id !== d.orderId || info.amount !== pay.amountMinor || info.currency !== pay.currency) throw new BadRequestException("Payment details do not match.");
    if (info.status === "authorized") info = await this.rzp(`/payments/${d.paymentId}/capture`, { method: "POST", body: { amount: pay.amountMinor, currency: pay.currency } });
    if (info.status === "captured") await this.settle(d.orderId, d.paymentId, info.amount);
    return this.status(u.id);
  }

  /** Idempotent: webhook retries and the browser callback can both call it safely. */
  async settle(orderId: string, paymentId: string, amount: number) {
    await this.db.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({ where: { providerOrderId: orderId } });
      if (!pay) return;
      if (amount !== pay.amountMinor) { this.log.error(`Amount mismatch for order ${orderId}`); return; }
      const lock = await tx.payment.updateMany({ where: { id: pay.id, status: { not: "SUCCEEDED" } }, data: { status: "SUCCEEDED", providerPaymentId: paymentId } });
      if (!lock.count) return; // already processed
      const plan = await tx.subscriptionPlan.findUnique({ where: { code: pay.planCode } });
      if (!plan) { this.log.error(`Unknown plan ${pay.planCode}`); return; }
      const now = new Date();
      const cur = await tx.subscription.findFirst({ where: { userId: pay.userId, ...ENTITLED(now) }, orderBy: { currentPeriodEnd: "desc" } });
      const end = addMonths(cur ? cur.currentPeriodEnd : now, plan.intervalMonths); // buying again extends the period
      const sub = cur ? await tx.subscription.update({ where: { id: cur.id }, data: { currentPeriodEnd: end, status: "ACTIVE", planId: plan.id } })
        : await tx.subscription.create({ data: { userId: pay.userId, planId: plan.id, currentPeriodEnd: end } });
      await tx.payment.update({ where: { id: pay.id }, data: { subscriptionId: sub.id } });
      await tx.notification.create({ data: { userId: pay.userId, type: "ACCOUNT", title: "Premium is active", body: `Your membership runs until ${end.toLocaleDateString("en-IN")}.`, href: "/premium" } });
    });
  }
  private async refunded(paymentId: string) {
    await this.db.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({ where: { providerPaymentId: paymentId } });
      if (!pay || pay.status === "REFUNDED") return;
      await tx.payment.update({ where: { id: pay.id }, data: { status: "REFUNDED" } });
      if (pay.subscriptionId) await tx.subscription.update({ where: { id: pay.subscriptionId }, data: { status: "EXPIRED", currentPeriodEnd: new Date() } }); // refunds end access
    });
  }

  async webhook(raw: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !raw || !signature || !safeEq(hmac(secret, raw), signature)) throw new BadRequestException("Invalid signature.");
    const ev = JSON.parse(raw.toString("utf8"));
    switch (ev.event) {
      case "payment.captured": { const p = ev.payload.payment.entity; await this.settle(p.order_id, p.id, p.amount); break; }
      case "payment.failed": await this.db.payment.updateMany({ where: { providerOrderId: ev.payload.payment.entity.order_id, status: "PENDING" }, data: { status: "FAILED" } }); break;
      case "refund.processed": await this.refunded(ev.payload.refund.entity.payment_id); break;
    }
  }

  async cancel(userId: string) {
    const r = await this.db.subscription.updateMany({ where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } }, data: { status: "CANCELED" } }); // access continues until the period ends
    if (!r.count) throw new NotFoundException("No active membership to cancel.");
  }

  adminPlans() { return this.db.subscriptionPlan.findMany({ orderBy: { priceMinor: "asc" } }); }
  async updatePlan(id: string, d: PlanDto, actorId: string) {
    await this.db.$transaction(async (tx) => {
      if (!(await tx.subscriptionPlan.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException("Plan not found.");
      await tx.subscriptionPlan.update({ where: { id }, data: d });
      await tx.auditLog.create({ data: { actorId, action: "plan.update", resource: "SubscriptionPlan", resourceId: id, meta: { fields: Object.keys(d) } } });
    });
  }
}

@ApiTags("billing")
@Controller()
export class BillingController {
  constructor(private svc: BillingService) {}
  @Get("billing/plans") plans() { return this.svc.plans(); }
  @Authenticated() @Get("billing/status") status(@CurrentUser() u: AuthUser) { return this.svc.status(u.id); }
  @Authenticated() @Get("billing/history") history(@CurrentUser() u: AuthUser) { return this.svc.history(u.id); }
  @Authenticated() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post("billing/checkout") checkout(@CurrentUser() u: AuthUser, @Body() d: CheckoutDto) { return this.svc.checkout(u, d.planCode); }
  @Authenticated() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post("billing/verify") verify(@CurrentUser() u: AuthUser, @Body() d: VerifyDto) { return this.svc.verify(u, d); }
  @Authenticated() @HttpCode(204) @Post("billing/cancel") cancel(@CurrentUser() u: AuthUser) { return this.svc.cancel(u.id); }

  // Called by Razorpay's servers: no cookies, no browser Origin. Authenticated by HMAC signature over the raw body.
  @SkipOrigin() @HttpCode(200) @Post("billing/webhook")
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers("x-razorpay-signature") sig?: string) { await this.svc.webhook(req.rawBody, sig); return { ok: true }; }

  @RequirePermission("user:manage") @Get("admin/plans") adminPlans() { return this.svc.adminPlans(); }
  @RequirePermission("user:manage") @HttpCode(204) @Put("admin/plans/:id") updatePlan(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: PlanDto) { return this.svc.updatePlan(id, d, u.id); }
}

@Module({ controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}
