"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const crypto_ts_1 = require("./crypto.ts");
(0, node_test_1.test)("sha256 matches the known test vector", () => {
    strict_1.default.equal((0, crypto_ts_1.sha256)("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
(0, node_test_1.test)("randomToken is long, URL-safe and unique", () => {
    const a = (0, crypto_ts_1.randomToken)(), b = (0, crypto_ts_1.randomToken)();
    strict_1.default.equal(a.length, 43);
    strict_1.default.match(a, /^[A-Za-z0-9_-]+$/);
    strict_1.default.notEqual(a, b);
});
//# sourceMappingURL=crypto.test.js.map