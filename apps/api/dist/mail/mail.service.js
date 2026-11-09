"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailModule = exports.MailService = void 0;
const common_1 = require("@nestjs/common");
// MAIL_PROVIDER=resend (needs RESEND_API_KEY and MAIL_FROM) sends real email.
// Without a provider, development prints the message to the console and production refuses to pretend.
let MailService = class MailService {
    log = new common_1.Logger("Mail");
    async send(to, subject, text) {
        if (process.env.MAIL_PROVIDER === "resend") {
            const r = await fetch("https://api.resend.com/emails", {
                method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text }),
            });
            if (!r.ok)
                throw new Error(`Mail provider responded ${r.status}`);
            return;
        }
        if (process.env.NODE_ENV === "production")
            throw new Error("No mail provider configured (set MAIL_PROVIDER)");
        this.log.log(`To: ${to} | ${subject}\n${text}`);
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)()
], MailService);
let MailModule = class MailModule {
};
exports.MailModule = MailModule;
exports.MailModule = MailModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({ providers: [MailService], exports: [MailService] })
], MailModule);
//# sourceMappingURL=mail.service.js.map