import { Global, Injectable, Logger, Module } from "@nestjs/common";

// MAIL_PROVIDER=resend (needs RESEND_API_KEY and MAIL_FROM) sends real email.
// Without a provider, development prints the message to the console and production refuses to pretend.
@Injectable()
export class MailService {
  private log = new Logger("Mail");
  async send(to: string, subject: string, text: string) {
    if (process.env.MAIL_PROVIDER === "resend") {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text }),
      });
      if (!r.ok) throw new Error(`Mail provider responded ${r.status}`);
      return;
    }
    if (process.env.NODE_ENV === "production") throw new Error("No mail provider configured (set MAIL_PROVIDER)");
    this.log.log(`To: ${to} | ${subject}\n${text}`);
  }
}
@Global() @Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
