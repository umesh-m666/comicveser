"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProd = isProd;
exports.webOrigins = webOrigins;
exports.primaryWebOrigin = primaryWebOrigin;
exports.isOriginAllowed = isOriginAllowed;
exports.isCrossSiteRequest = isCrossSiteRequest;
exports.sessionCookieOptions = sessionCookieOptions;
exports.getStartupDiagnostics = getStartupDiagnostics;
exports.assertProductionConfig = assertProductionConfig;
const common_1 = require("@nestjs/common");
const log = new common_1.Logger("Config");
function isProd() {
    return process.env.NODE_ENV === "production";
}
function normalizeOrigin(origin) {
    return origin.trim().replace(/\/+$/, "");
}
/**
 * Returns all allowed frontend origins from WEB_ORIGIN (comma-separated)
 * plus standard localhost ports in non-production environments.
 */
function webOrigins() {
    const raw = process.env.WEB_ORIGIN ?? "";
    const configured = raw
        .split(",")
        .map(normalizeOrigin)
        .filter(Boolean);
    if (!isProd()) {
        for (const devOrigin of ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]) {
            if (!configured.includes(devOrigin))
                configured.push(devOrigin);
        }
    }
    if (configured.length === 0) {
        configured.push("http://localhost:3000");
    }
    return configured;
}
/**
 * Primary frontend origin used for building links in emails (verification, password reset, alerts).
 */
function primaryWebOrigin() {
    return webOrigins()[0] ?? "http://localhost:3000";
}
/**
 * Checks whether an incoming request Origin header is permitted.
 */
function isOriginAllowed(origin) {
    if (!origin)
        return true;
    const normalized = normalizeOrigin(origin);
    const allowed = webOrigins();
    if (allowed.includes(normalized))
        return true;
    // Allow matching subdomains when COOKIE_DOMAIN is configured
    const cookieDomain = process.env.COOKIE_DOMAIN?.trim().replace(/^\./, "");
    if (cookieDomain) {
        try {
            const url = new URL(normalized);
            if (url.hostname === cookieDomain || url.hostname.endsWith(`.${cookieDomain}`)) {
                return true;
            }
        }
        catch {
            return false;
        }
    }
    return false;
}
/**
 * Determines whether the frontend and backend are hosted on different sites
 * (e.g. separate Render `.onrender.com` services or Vercel + Render),
 * which requires `SameSite=None; Secure` for cross-origin cookies.
 */
function isCrossSiteRequest(req) {
    const explicitSameSite = process.env.COOKIE_SAMESITE?.trim().toLowerCase();
    if (explicitSameSite === "none")
        return true;
    if (explicitSameSite === "lax" || explicitSameSite === "strict")
        return false;
    const originHeader = typeof req?.headers?.origin === "string" ? req.headers.origin : undefined;
    const hostHeader = (typeof req?.headers?.["x-forwarded-host"] === "string" ? req.headers["x-forwarded-host"] : undefined) ??
        (typeof req?.headers?.host === "string" ? req.headers.host : undefined);
    if (originHeader && hostHeader) {
        try {
            const originHost = new URL(originHeader).hostname.toLowerCase();
            const apiHost = hostHeader.split(",")[0].trim().split(":")[0].toLowerCase();
            if (originHost && apiHost && originHost !== apiHost) {
                return true;
            }
        }
        catch {
            // fall through
        }
    }
    if (isProd()) {
        try {
            const webUrl = new URL(primaryWebOrigin());
            if (webUrl.hostname.endsWith(".onrender.com") ||
                webUrl.hostname.endsWith(".vercel.app") ||
                webUrl.hostname.endsWith(".netlify.app")) {
                return true;
            }
        }
        catch {
            // fall through
        }
    }
    return false;
}
/**
 * Builds consistent HTTP-only session cookie options for both setting and clearing `cv_session`.
 */
function sessionCookieOptions(req, maxAgeMs) {
    const explicitSameSite = process.env.COOKIE_SAMESITE?.trim().toLowerCase();
    const forwardedProto = typeof req?.headers?.["x-forwarded-proto"] === "string"
        ? req.headers["x-forwarded-proto"].split(",")[0].trim().toLowerCase()
        : undefined;
    const isHttps = isProd() || req?.secure === true || req?.protocol === "https" || forwardedProto === "https";
    const crossSite = isCrossSiteRequest(req);
    let sameSite = "lax";
    if (explicitSameSite === "none" || explicitSameSite === "lax" || explicitSameSite === "strict") {
        sameSite = explicitSameSite;
    }
    else if (crossSite && isHttps) {
        sameSite = "none";
    }
    const secure = sameSite === "none" ? true : isHttps;
    const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
    const opts = {
        httpOnly: true,
        secure,
        sameSite,
        path: "/",
        ...(domain ? { domain } : {}),
        ...(typeof maxAgeMs === "number" ? { maxAge: maxAgeMs } : {}),
    };
    return opts;
}
function getStartupDiagnostics() {
    const warnings = [];
    const origins = webOrigins();
    const mailProvider = (process.env.MAIL_PROVIDER ?? "log").trim().toLowerCase();
    const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
    const mailFromConfigured = Boolean(process.env.MAIL_FROM?.trim());
    const googleClientId = (process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();
    const googleAuthConfigured = Boolean(googleClientId);
    if (isProd()) {
        if (!process.env.WEB_ORIGIN) {
            warnings.push("WEB_ORIGIN is not set in production; cross-origin requests and email links may fail.");
        }
        else if (!origins.every((o) => o.startsWith("https://"))) {
            warnings.push("One or more WEB_ORIGIN entries do not use https:// in production.");
        }
        if (!process.env.TRUST_PROXY) {
            warnings.push("TRUST_PROXY is not set; defaulting trust proxy to 1 in production so secure cookies and rate limits work behind Render/Cloudflare.");
        }
    }
    if (mailProvider === "resend") {
        if (!resendConfigured)
            warnings.push("MAIL_PROVIDER=resend is set, but RESEND_API_KEY is missing.");
        if (!mailFromConfigured)
            warnings.push("MAIL_PROVIDER=resend is set, but MAIL_FROM is missing.");
    }
    else if (isProd()) {
        warnings.push(`MAIL_PROVIDER is '${mailProvider}' instead of 'resend'; transactional emails will only be logged.`);
    }
    if (!googleAuthConfigured) {
        warnings.push("GOOGLE_CLIENT_ID is not configured; Google Sign-In will return a configuration notice until set.");
    }
    return {
        environment: process.env.NODE_ENV ?? "development",
        webOrigins: origins,
        mailProvider,
        resendConfigured,
        mailFromConfigured,
        googleAuthConfigured,
        warnings,
    };
}
/** Validates production configuration and logs actionable diagnostics without exposing secret values. */
function assertProductionConfig() {
    const diag = getStartupDiagnostics();
    for (const w of diag.warnings) {
        log.warn(w);
    }
    if (!isProd())
        return;
    if (!process.env.DATABASE_URL) {
        throw new Error("Missing required production setting: DATABASE_URL");
    }
}
