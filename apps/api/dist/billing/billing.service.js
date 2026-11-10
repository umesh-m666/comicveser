"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e, _f, _g, _h;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = exports.BillingController = exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const class_validator_1 = require("class-validator");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/auth.guard");
class CheckoutDto {
    planCode;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 40),
    __metadata("design:type", String)
], CheckoutDto.prototype, "planCode", void 0);
class VerifyDto {
    orderId;
    paymentId;
    signature;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 60),
    __metadata("design:type", String)
], VerifyDto.prototype, "orderId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 60),
    __metadata("design:type", String)
], VerifyDto.prototype, "paymentId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 200),
    __metadata("design:type", String)
], VerifyDto.prototype, "signature", void 0);
class PlanDto {
    name;
    priceMinor;
    active;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 80),
    __metadata("design:type", String)
], PlanDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(100),
    (0, class_validator_1.Max)(10_000_000),
    __metadata("design:type", Number)
], PlanDto.prototype, "priceMinor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PlanDto.prototype, "active", void 0);
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && (0, crypto_1.timingSafeEqual)(x, y); };
const hmac = (secret, data) => (0, crypto_1.createHmac)("sha256", secret).update(data).digest("hex");
const ENTITLED = (now) => ({ status: { in: ["ACTIVE", "CANCELED"] }, currentPeriodEnd: { gt: now } });
let BillingService = class BillingService {
    db;
    log = new common_1.Logger("Billing");
    constructor(db) {
        this.db = db;
    }
    get enabled() { return process.env.PAYMENTS_ENABLED === "true" && !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET; }
    need() { if (!this.enabled)
        throw new common_1.ServiceUnavailableException("Premium memberships are not available right now."); }
    async rzp(path, init = {}) {
        const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
        const r = await fetch(`https://api.razorpay.com/v1${path}`, { method: init.method ?? "GET", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: init.body ? JSON.stringify(init.body) : undefined });
        if (!r.ok) {
            this.log.error(`Razorpay ${path} -> ${r.status}`);
            throw new common_1.BadGatewayException("The payment provider returned an error. Please try again.");
        }
        return r.json();
    }
    async plans() {
        if ((await this.db.subscriptionPlan.count()) === 0)
            await this.db.subscriptionPlan.createMany({ skipDuplicates: true, data: [{ code: "premium_monthly", name: "Premium Monthly", priceMinor: 14900, intervalMonths: 1 }, { code: "premium_yearly", name: "Premium Yearly", priceMinor: 149900, intervalMonths: 12 }] });
        return { enabled: this.enabled, plans: await this.db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { priceMinor: "asc" }, select: { code: true, name: true, priceMinor: true, currency: true, intervalMonths: true } }) };
    }
    async status(userId) {
        const sub = await this.db.subscription.findFirst({ where: { userId, ...ENTITLED(new Date()) }, orderBy: { currentPeriodEnd: "desc" }, include: { plan: { select: { name: true } } } });
        return { premium: !!sub, until: sub?.currentPeriodEnd ?? null, plan: sub?.plan.name ?? null, canceled: sub?.status === "CANCELED" };
    }
    async history(userId) {
        const rows = await this.db.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
        return rows.map((p) => ({ id: p.id, invoiceNo: `INV-${p.createdAt.getFullYear()}-${p.id.slice(-8).toUpperCase()}`, planCode: p.planCode, amountMinor: p.amountMinor, currency: p.currency, status: p.status, createdAt: p.createdAt }));
    }
    async checkout(u, planCode) {
        this.need();
        if (!u.emailVerified)
            throw new common_1.ForbiddenException("Verify your email before subscribing.");
        const plan = await this.db.subscriptionPlan.findFirst({ where: { code: planCode, active: true } });
        if (!plan)
            throw new common_1.NotFoundException("Plan not found.");
        const order = await this.rzp("/orders", { method: "POST", body: { amount: plan.priceMinor, currency: plan.currency, receipt: `cv_${Date.now()}`, notes: { userId: u.id, planCode } } });
        await this.db.payment.create({ data: { userId: u.id, amountMinor: plan.priceMinor, currency: plan.currency, providerOrderId: order.id, planCode } });
        return { orderId: order.id, amount: plan.priceMinor, currency: plan.currency, keyId: process.env.RAZORPAY_KEY_ID, planName: plan.name };
    }
    /** Browser callback. The signature is checked with our secret and the payment is re-read from Razorpay; the browser's word alone is never enough. */
    async verify(u, d) {
        this.need();
        if (!safeEq(hmac(process.env.RAZORPAY_KEY_SECRET, `${d.orderId}|${d.paymentId}`), d.signature))
            throw new common_1.BadRequestException("Payment signature is invalid.");
        const pay = await this.db.payment.findUnique({ where: { providerOrderId: d.orderId } });
        if (!pay || pay.userId !== u.id)
            throw new common_1.NotFoundException("Payment not found.");
        let info = await this.rzp(`/payments/${d.paymentId}`);
        if (info.order_id !== d.orderId || info.amount !== pay.amountMinor || info.currency !== pay.currency)
            throw new common_1.BadRequestException("Payment details do not match.");
        if (info.status === "authorized")
            info = await this.rzp(`/payments/${d.paymentId}/capture`, { method: "POST", body: { amount: pay.amountMinor, currency: pay.currency } });
        if (info.status === "captured")
            await this.settle(d.orderId, d.paymentId, info.amount);
        return this.status(u.id);
    }
    /** Idempotent: webhook retries and the browser callback can both call it safely. */
    async settle(orderId, paymentId, amount) {
        await this.db.$transaction(async (tx) => {
            const pay = await tx.payment.findUnique({ where: { providerOrderId: orderId } });
            if (!pay)
                return;
            if (amount !== pay.amountMinor) {
                this.log.error(`Amount mismatch for order ${orderId}`);
                return;
            }
            const lock = await tx.payment.updateMany({ where: { id: pay.id, status: { not: "SUCCEEDED" } }, data: { status: "SUCCEEDED", providerPaymentId: paymentId } });
            if (!lock.count)
                return; // already processed
            const plan = await tx.subscriptionPlan.findUnique({ where: { code: pay.planCode } });
            if (!plan) {
                this.log.error(`Unknown plan ${pay.planCode}`);
                return;
            }
            const now = new Date();
            const cur = await tx.subscription.findFirst({ where: { userId: pay.userId, ...ENTITLED(now) }, orderBy: { currentPeriodEnd: "desc" } });
            const end = addMonths(cur ? cur.currentPeriodEnd : now, plan.intervalMonths); // buying again extends the period
            const sub = cur ? await tx.subscription.update({ where: { id: cur.id }, data: { currentPeriodEnd: end, status: "ACTIVE", planId: plan.id } })
                : await tx.subscription.create({ data: { userId: pay.userId, planId: plan.id, currentPeriodEnd: end } });
            await tx.payment.update({ where: { id: pay.id }, data: { subscriptionId: sub.id } });
            await tx.notification.create({ data: { userId: pay.userId, type: "ACCOUNT", title: "Premium is active", body: `Your membership runs until ${end.toLocaleDateString("en-IN")}.`, href: "/premium" } });
        });
    }
    async refunded(paymentId) {
        await this.db.$transaction(async (tx) => {
            const pay = await tx.payment.findUnique({ where: { providerPaymentId: paymentId } });
            if (!pay || pay.status === "REFUNDED")
                return;
            await tx.payment.update({ where: { id: pay.id }, data: { status: "REFUNDED" } });
            if (pay.subscriptionId)
                await tx.subscription.update({ where: { id: pay.subscriptionId }, data: { status: "EXPIRED", currentPeriodEnd: new Date() } }); // refunds end access
        });
    }
    async webhook(raw, signature) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret || !raw || !signature || !safeEq(hmac(secret, raw), signature))
            throw new common_1.BadRequestException("Invalid signature.");
        const ev = JSON.parse(raw.toString("utf8"));
        switch (ev.event) {
            case "payment.captured": {
                const p = ev.payload.payment.entity;
                await this.settle(p.order_id, p.id, p.amount);
                break;
            }
            case "payment.failed":
                await this.db.payment.updateMany({ where: { providerOrderId: ev.payload.payment.entity.order_id, status: "PENDING" }, data: { status: "FAILED" } });
                break;
            case "refund.processed":
                await this.refunded(ev.payload.refund.entity.payment_id);
                break;
        }
    }
    async cancel(userId) {
        const r = await this.db.subscription.updateMany({ where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } }, data: { status: "CANCELED" } }); // access continues until the period ends
        if (!r.count)
            throw new common_1.NotFoundException("No active membership to cancel.");
    }
    adminPlans() { return this.db.subscriptionPlan.findMany({ orderBy: { priceMinor: "asc" } }); }
    async updatePlan(id, d, actorId) {
        await this.db.$transaction(async (tx) => {
            if (!(await tx.subscriptionPlan.findUnique({ where: { id }, select: { id: true } })))
                throw new common_1.NotFoundException("Plan not found.");
            await tx.subscriptionPlan.update({ where: { id }, data: d });
            await tx.auditLog.create({ data: { actorId, action: "plan.update", resource: "SubscriptionPlan", resourceId: id, meta: { fields: Object.keys(d) } } });
        });
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object])
], BillingService);
let BillingController = class BillingController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    plans() { return this.svc.plans(); }
    status(u) { return this.svc.status(u.id); }
    history(u) { return this.svc.history(u.id); }
    checkout(u, d) { return this.svc.checkout(u, d.planCode); }
    verify(u, d) { return this.svc.verify(u, d); }
    cancel(u) { return this.svc.cancel(u.id); }
    // Called by Razorpay's servers: no cookies, no browser Origin. Authenticated by HMAC signature over the raw body.
    async webhook(req, sig) { await this.svc.webhook(req.rawBody, sig); return { ok: true }; }
    adminPlans() { return this.svc.adminPlans(); }
    updatePlan(u, id, d) { return this.svc.updatePlan(id, d, u.id); }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)("billing/plans"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "plans", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("billing/status"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "status", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.Get)("billing/history"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _c : Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "history", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("billing/checkout"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_d = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _d : Object, CheckoutDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "checkout", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("billing/verify"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _e : Object, VerifyDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "verify", null);
__decorate([
    (0, auth_guard_1.Authenticated)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)("billing/cancel"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "cancel", null);
__decorate([
    (0, auth_guard_1.SkipOrigin)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)("billing/webhook"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)("x-razorpay-signature")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_g = typeof common_1.RawBodyRequest !== "undefined" && common_1.RawBodyRequest) === "function" ? _g : Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "webhook", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("user:manage"),
    (0, common_1.Get)("admin/plans"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "adminPlans", null);
__decorate([
    (0, auth_guard_1.RequirePermission)("user:manage"),
    (0, common_1.HttpCode)(204),
    (0, common_1.Put)("admin/plans/:id"),
    __param(0, (0, auth_guard_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof auth_guard_1.AuthUser !== "undefined" && auth_guard_1.AuthUser) === "function" ? _h : Object, String, PlanDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "updatePlan", null);
exports.BillingController = BillingController = __decorate([
    (0, swagger_1.ApiTags)("billing"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [BillingService])
], BillingController);
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Module)({ controllers: [BillingController], providers: [BillingService] })
], BillingModule);
