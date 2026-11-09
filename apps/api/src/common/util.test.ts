import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./util.ts";

test("slugify makes URL-safe slugs", () => {
  assert.equal(slugify("Hello World!"), "hello-world");
  assert.equal(slugify("  --Spiced Up--  "), "spiced-up");
  assert.equal(slugify("ALL CAPS 123"), "all-caps-123");
  assert.equal(slugify("Café Olé"), "cafe-ole");
});
test("slugify handles empty and long input", () => {
  assert.equal(slugify("!!!"), "");
  assert.ok(slugify("a".repeat(200)).length <= 80);
});
test("slugify never emits path or HTML characters", () => {
  assert.match(slugify("../../etc/passwd <script>"), /^[a-z0-9-]*$/);
});
