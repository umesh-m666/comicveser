import { test } from "node:test";
import assert from "node:assert/strict";
import { randomToken, sha256 } from "./crypto.ts";

test("sha256 matches the known test vector", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("randomToken is long, URL-safe and unique", () => {
  const a = randomToken(), b = randomToken();
  assert.equal(a.length, 43);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b);
});
