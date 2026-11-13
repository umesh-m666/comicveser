"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = exports.randomToken = void 0;
const crypto_1 = require("crypto");
const randomToken = () => (0, crypto_1.randomBytes)(32).toString("base64url");
exports.randomToken = randomToken;
const sha256 = (s) => (0, crypto_1.createHash)("sha256").update(s).digest("hex");
exports.sha256 = sha256;
