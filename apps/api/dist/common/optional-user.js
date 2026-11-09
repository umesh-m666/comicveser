"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalUserId = optionalUserId;
const crypto_1 = require("./crypto");
/** Returns the signed-in user's id if a valid session cookie is present; never throws. */
async function optionalUserId(db, req) {
    const t = req.cookies?.["cv_session"];
    if (!t)
        return null;
    const s = await db.session.findUnique({ where: { tokenHash: (0, crypto_1.sha256)(t) }, select: { userId: true, expiresAt: true } });
    return s && s.expiresAt > new Date() ? s.userId : null;
}
//# sourceMappingURL=optional-user.js.map