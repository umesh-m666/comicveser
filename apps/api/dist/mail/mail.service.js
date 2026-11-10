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
const RESEND_API_URL = "https://api.resend.com/emails";
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function buildBrandedHtml(params) {
    const greetingHtml = params.greeting
        ? `<p style="margin:0 0 16px;font-size:15px;color:#e4e4e7;">${escapeHtml(params.greeting)}</p>`
        : "";
    const bodyHtml = params.paragraphs
        .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d4d4d8;">${escapeHtml(p)}</p>`)
        .join("");
    const ctaHtml = params.ctaLabel && params.ctaUrl
        ? `<div style="margin:24px 0;"><a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;padding:12px 24px;background-color:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(params.ctaLabel)}</a></div>
         <p style="margin:0 0 16px;font-size:12px;color:#a1a1aa;word-break:break-all;">Or copy and paste this link: ${escapeHtml(params.ctaUrl)}</p>`
        : "";
    const footerHtml = params.footerNote
        ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #27272a;font-size:12px;color:#71717a;">${escapeHtml(params.footerNote)}</p>`
        : "";
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4f4f5;">
  <div style="max-width:560px;margin:0 auto;background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;">
    <div style="margin-bottom:24px;display:flex;align-items:center;">
      <span style="font-size:20px;font-weight:800;color:#a78bfa;letter-spacing:-0.02em;">ComicVerse</span>
    </div>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#ffffff;">${escapeHtml(params.heading)}</h1>
    ${greetingHtml}
    ${bodyHtml}
    ${ctaHtml}
    ${footerHtml}
  </div>
</body>
</html>`;
}
let MailService = class MailService {
    log = new common_1.Logger("Mail");
    failures = [];
    customTransport = null;
    onModuleInit() {
        const status = this.getConfigStatus();
        if (!status.configured && status.provider === "resend") {
            this.log.warn(`Resend email configuration incomplete: ${status.issues.join("; ")}`);
        }
        else if (status.provider === "resend") {
            this.log.log(`MailService initialized with provider=resend, from='${status.from}'`);
        }
        else {
            this.log.log(`MailService initialized in '${status.provider}' mode (from='${status.from}')`);
        }
    }
    /** Allows tests to inject a mock transport. */
    setCustomTransport(fn) {
        this.customTransport = fn;
    }
    getConfigStatus() {
        const provider = (process.env.MAIL_PROVIDER ?? "log").trim().toLowerCase();
        const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
        const from = (process.env.MAIL_FROM ?? "ComicVerse <noreply@comicverse.local>").trim();
        const issues = [];
        if (provider === "resend") {
            if (!apiKey)
                issues.push("RESEND_API_KEY is missing");
            if (!process.env.MAIL_FROM?.trim())
                issues.push("MAIL_FROM is missing");
            else if (from.endsWith(".local") || from.endsWith(".local>")) {
                issues.push("MAIL_FROM uses an unverified .local domain; Resend requires a verified domain or onboarding@resend.dev");
            }
        }
        return {
            provider,
            hasApiKey: Boolean(apiKey),
            from,
            configured: provider === "resend" ? issues.length === 0 : true,
            issues,
        };
    }
    getRecentFailures() {
        return [...this.failures].reverse();
    }
    recordFailure(to, subject, code, message) {
        this.failures.push({
            at: new Date().toISOString(),
            to,
            subject,
            code,
            message,
        });
        if (this.failures.length > 50)
            this.failures.shift();
    }
    async send(to, subject, text, html) {
        const recipient = to?.trim();
        if (!recipient) {
            throw new common_1.ServiceUnavailableException("Recipient email address is required.");
        }
        const provider = (process.env.MAIL_PROVIDER ?? "log").trim().toLowerCase();
        const from = (process.env.MAIL_FROM ?? "ComicVerse <noreply@comicverse.local>").trim();
        const renderedHtml = html ??
            buildBrandedHtml({
                heading: subject,
                paragraphs: text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
                footerNote: "You received this email from ComicVerse.",
            });
        if (this.customTransport) {
            try {
                return await this.customTransport({ to: recipient, from, subject, text, html: renderedHtml });
            }
            catch (err) {
                const msg = err?.message ?? "Custom mail transport error";
                this.recordFailure(recipient, subject, "TRANSPORT_ERROR", msg);
                this.log.error(`Mail delivery failed to ${recipient} (${subject}): ${msg}`);
                throw new common_1.ServiceUnavailableException(`Email delivery failed: ${msg}`);
            }
        }
        if (provider === "resend") {
            const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
            if (!apiKey) {
                const msg = "MAIL_PROVIDER is 'resend' but RESEND_API_KEY is not configured.";
                this.recordFailure(recipient, subject, "MISSING_API_KEY", msg);
                this.log.error(msg);
                throw new common_1.ServiceUnavailableException("Email service is not configured (missing RESEND_API_KEY).");
            }
            if (!process.env.MAIL_FROM?.trim()) {
                const msg = "MAIL_PROVIDER is 'resend' but MAIL_FROM is not configured.";
                this.recordFailure(recipient, subject, "MISSING_MAIL_FROM", msg);
                this.log.error(msg);
                throw new common_1.ServiceUnavailableException("Email sender address (MAIL_FROM) is not configured.");
            }
            try {
                const response = await fetch(RESEND_API_URL, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from,
                        to: [recipient],
                        subject,
                        text,
                        html: renderedHtml,
                    }),
                });
                const payload = (await response.json().catch(() => ({})));
                if (!response.ok || payload?.error) {
                    const code = payload?.error?.name ?? payload?.name ?? `HTTP_${response.status}`;
                    const errMsg = payload?.error?.message ??
                        payload?.message ??
                        `Resend rejected the email request (HTTP ${response.status}).`;
                    this.recordFailure(recipient, subject, code, errMsg);
                    this.log.error(`Resend error [${code}] to ${recipient} (from ${from}): ${errMsg}`);
                    throw new common_1.ServiceUnavailableException(`Email provider error: ${errMsg}`);
                }
                this.log.log(`Sent email via Resend to ${recipient} [subject="${subject}", id=${payload?.id ?? "ok"}]`);
                return { id: payload?.id };
            }
            catch (err) {
                if (err instanceof common_1.ServiceUnavailableException)
                    throw err;
                const msg = err?.message ?? "Unexpected Resend network failure";
                this.recordFailure(recipient, subject, "RESEND_NETWORK_ERROR", msg);
                this.log.error(`Resend delivery exception to ${recipient}: ${msg}`);
                throw new common_1.ServiceUnavailableException("Could not deliver email via Resend.");
            }
        }
        if (process.env.NODE_ENV === "production") {
            const msg = `MAIL_PROVIDER is '${provider}' in production; set MAIL_PROVIDER=resend with RESEND_API_KEY and MAIL_FROM.`;
            this.recordFailure(recipient, subject, "PROVIDER_NOT_CONFIGURED", msg);
            this.log.warn(`${msg} Falling back to structured log for ${recipient} (${subject}).`);
        }
        this.log.log(`[dev-mail] to=${recipient} subject="${subject}" — ${text.replace(/\s+/g, " ").slice(0, 240)}`);
        return { id: "dev-log" };
    }
    async sendVerificationEmail(to, username, verifyUrl) {
        const subject = "Verify your ComicVerse email";
        const text = `Hi ${username},\n\nWelcome to ComicVerse! Please verify your email address by opening the link below:\n\n${verifyUrl}\n\nThis verification link expires in 48 hours. If you did not create a ComicVerse account, you can safely ignore this email.`;
        const html = buildBrandedHtml({
            heading: "Verify your email address",
            greeting: `Hi ${username},`,
            paragraphs: [
                "Welcome to ComicVerse! Confirm your email address below to activate full account features and notifications.",
                "This verification link is valid for 48 hours.",
            ],
            ctaLabel: "Verify Email Address",
            ctaUrl: verifyUrl,
            footerNote: "If you did not create a ComicVerse account, you can safely ignore this message.",
        });
        return this.send(to, subject, text, html);
    }
    async sendPasswordResetEmail(to, username, resetUrl) {
        const subject = "Reset your ComicVerse password";
        const text = `Hi ${username},\n\nWe received a request to reset your ComicVerse password. Open the link below within 1 hour to choose a new password:\n\n${resetUrl}\n\nIf you did not request a password reset, no changes have been made to your account.`;
        const html = buildBrandedHtml({
            heading: "Reset your password",
            greeting: `Hi ${username},`,
            paragraphs: [
                "We received a request to reset the password for your ComicVerse account.",
                "Click the button below within 1 hour to set a new password.",
            ],
            ctaLabel: "Reset Password",
            ctaUrl: resetUrl,
            footerNote: "If you did not request a password reset, you can safely ignore this email.",
        });
        return this.send(to, subject, text, html);
    }
    async sendPasswordChangedEmail(to, username) {
        const subject = "Your ComicVerse password was changed";
        const text = `Hi ${username},\n\nYour ComicVerse account password was just changed, and all existing sessions have been signed out.\n\nIf you did not make this change, please reset your password immediately.`;
        const html = buildBrandedHtml({
            heading: "Password changed successfully",
            greeting: `Hi ${username},`,
            paragraphs: [
                "Your ComicVerse password was just updated, and any previous active sessions have been signed out for your security.",
                "If you did not perform this change, please reset your password immediately.",
            ],
            footerNote: "ComicVerse Security Notification",
        });
        return this.send(to, subject, text, html);
    }
    async sendLoginNotificationEmail(to, username, meta) {
        const when = (meta.at ?? new Date()).toUTCString();
        const subject = "New sign-in to your ComicVerse account";
        const text = `Hi ${username},\n\nA new sign-in to your ComicVerse account occurred via ${meta.provider} on ${when}${meta.userAgent ? ` (${meta.userAgent})` : ""}.\n\nIf this was you, no action is needed.`;
        const html = buildBrandedHtml({
            heading: "New sign-in detected",
            greeting: `Hi ${username},`,
            paragraphs: [
                `Your ComicVerse account was signed into using ${meta.provider} on ${when}.`,
                ...(meta.userAgent ? [`Device / Browser: ${meta.userAgent}`] : []),
            ],
            footerNote: "If you recognize this activity, you can disregard this alert.",
        });
        return this.send(to, subject, text, html);
    }
    async sendAccountNoticeEmail(to, username, title, message, actionUrl) {
        const text = `Hi ${username},\n\n${title}\n\n${message}${actionUrl ? `\n\nView details: ${actionUrl}` : ""}`;
        const html = buildBrandedHtml({
            heading: title,
            greeting: `Hi ${username},`,
            paragraphs: message.split(/\n+/).filter(Boolean),
            ctaLabel: actionUrl ? "Open in ComicVerse" : undefined,
            ctaUrl: actionUrl,
            footerNote: "ComicVerse Account & Support Team",
        });
        return this.send(to, title, text, html);
    }
    async sendAdminIssueAlertEmail(to, report) {
        const subject = `[ComicVerse Issue Report] ${report.category}: ${report.subject || report.id}`;
        const text = `New user issue report submitted on ComicVerse:\n\nReport ID: ${report.id}\nUser: ${report.username} (${report.email})\nCategory: ${report.category}\nSubject: ${report.subject}\nDescription:\n${report.description}${report.adminUrl ? `\n\nReview in Admin Panel: ${report.adminUrl}` : ""}`;
        const html = buildBrandedHtml({
            heading: `New Issue Report (${report.category})`,
            paragraphs: [
                `Submitted by: ${report.username} (${report.email})`,
                `Subject: ${report.subject || "(No subject)"}`,
                `Description: ${report.description}`,
            ],
            ctaLabel: report.adminUrl ? "Open Admin Issue Reports" : undefined,
            ctaUrl: report.adminUrl,
            footerNote: `Report ID: ${report.id}`,
        });
        return this.send(to, subject, text, html);
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
