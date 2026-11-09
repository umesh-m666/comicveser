import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSourcesConfig } from "./sources.config";

test("off by default, and bad values are ignored while off", () => {
  assert.equal(loadSourcesConfig({}).enabled, false);
  assert.equal(loadSourcesConfig({ SOURCES_TIMEOUT_MS: "banana" }).enabled, false);
});
test("on: defaults to a 10 s timeout and an honest app User-Agent", () => {
  const c = loadSourcesConfig({ SOURCES_ENABLED: "true", WEB_ORIGIN: "https://example.com" });
  assert.equal(c.timeoutMs, 10000);
  assert.equal(c.userAgent, "ComicVerse/1.0 (+https://example.com)");
});
test("rejects a bad timeout", () => {
  for (const t of ["10", "999999", "1.5", "abc"]) assert.throws(() => loadSourcesConfig({ SOURCES_ENABLED: "true", SOURCES_TIMEOUT_MS: t }), /SOURCES_TIMEOUT_MS/);
});
test("rejects a User-Agent that imitates a browser", () => {
  assert.throws(() => loadSourcesConfig({ SOURCES_ENABLED: "true", SOURCES_USER_AGENT: "Mozilla/5.0 (Windows NT 10.0) Chrome/120" }), /identify your app/);
});
