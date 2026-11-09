"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertProductionConfig = assertProductionConfig;
/** Fails fast in production when required settings are missing, instead of failing later on a user request. */
function assertProductionConfig() {
    if (process.env.NODE_ENV !== "production")
        return;
    const missing = ["DATABASE_URL", "WEB_ORIGIN", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter((k) => !process.env[k]);
    if (!process.env.MAIL_PROVIDER)
        missing.push("MAIL_PROVIDER");
    if (process.env.WEB_ORIGIN && !process.env.WEB_ORIGIN.startsWith("https://"))
        missing.push("WEB_ORIGIN (must be https)");
    if (missing.length)
        throw new Error(`Missing or invalid production settings: ${missing.join(", ")}`);
}
//# sourceMappingURL=config.js.map