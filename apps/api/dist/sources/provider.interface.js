"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceError = void 0;
const STATUS = { SOURCE_UNAVAILABLE: 503, SOURCE_TIMEOUT: 504, SOURCE_RATE_LIMITED: 429, NOT_FOUND: 404, BAD_RESPONSE: 502, INVALID_REQUEST: 400 };
/** A failure talking to an external source. Messages are safe to show to users (no URLs, no stack traces). */
class SourceError extends Error {
    code;
    status;
    retryAfterSeconds;
    constructor(code, message, retryAfterSeconds) {
        super(message);
        this.name = "SourceError";
        this.code = code;
        this.status = STATUS[code];
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
exports.SourceError = SourceError;
//# sourceMappingURL=provider.interface.js.map