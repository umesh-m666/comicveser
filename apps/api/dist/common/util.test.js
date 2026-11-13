"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const util_ts_1 = require("./util.ts");
(0, node_test_1.test)("slugify makes URL-safe slugs", () => {
    strict_1.default.equal((0, util_ts_1.slugify)("Hello World!"), "hello-world");
    strict_1.default.equal((0, util_ts_1.slugify)("  --Spiced Up--  "), "spiced-up");
    strict_1.default.equal((0, util_ts_1.slugify)("ALL CAPS 123"), "all-caps-123");
    strict_1.default.equal((0, util_ts_1.slugify)("Café Olé"), "cafe-ole");
});
(0, node_test_1.test)("slugify handles empty and long input", () => {
    strict_1.default.equal((0, util_ts_1.slugify)("!!!"), "");
    strict_1.default.ok((0, util_ts_1.slugify)("a".repeat(200)).length <= 80);
});
(0, node_test_1.test)("slugify never emits path or HTML characters", () => {
    strict_1.default.match((0, util_ts_1.slugify)("../../etc/passwd <script>"), /^[a-z0-9-]*$/);
});
