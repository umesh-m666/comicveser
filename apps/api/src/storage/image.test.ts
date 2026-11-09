import { test } from "node:test";
import assert from "node:assert/strict";
import { dimensions, sniff } from "./image.ts";

const pad = (b: number[], n = 64) => Buffer.concat([Buffer.from(b), Buffer.alloc(Math.max(0, n - b.length))]);
const ascii = (s: string) => [...Buffer.from(s, "ascii")];
const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

const png = (w: number, h: number) => pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...u32be(13), ...ascii("IHDR"), ...u32be(w), ...u32be(h)]);
const jpeg = (w: number, h: number) => pad([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
  0xff, 0xc0, 0x00, 0x11, 8, h >> 8, h & 255, w >> 8, w & 255, 3]);
const webpHead = (chunk: string) => [...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii(chunk), 0, 0, 0, 0];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

test("sniff recognises the real format from bytes", () => {
  assert.equal(sniff(png(10, 10)), "image/png");
  assert.equal(sniff(jpeg(10, 10)), "image/jpeg");
  assert.equal(sniff(pad(webpHead("VP8X"))), "image/webp");
  assert.equal(sniff(pad([0, 0, 0, 0x20, ...ascii("ftypavif")])), "image/avif");
});

test("sniff rejects non-images however they are named", () => {
  assert.equal(sniff(pad(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))), null);
  assert.equal(sniff(pad([0x50, 0x4b, 0x03, 0x04])), null); // ZIP
  assert.equal(sniff(pad(ascii("MZ"))), null); // Windows executable
  assert.equal(sniff(Buffer.from([0xff, 0xd8])), null); // too short
});

test("dimensions: PNG", () => assert.deepEqual(dimensions(png(800, 1200), "image/png"), { width: 800, height: 1200 }));
test("dimensions: JPEG (skips APP0 to find SOF)", () => assert.deepEqual(dimensions(jpeg(720, 4000), "image/jpeg"), { width: 720, height: 4000 }));
test("dimensions: WebP VP8X", () => {
  const b = pad([...webpHead("VP8X"), 0, 0, 0, 0, ...le24(899), ...le24(1599)]);
  assert.deepEqual(dimensions(b, "image/webp"), { width: 900, height: 1600 });
});
test("dimensions: WebP VP8L", () => {
  const v = (640 - 1) | ((960 - 1) << 14);
  const b = pad([...webpHead("VP8L"), 0x2f, v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]);
  assert.deepEqual(dimensions(b, "image/webp"), { width: 640, height: 960 });
});
test("dimensions: WebP VP8 lossy", () => {
  const b = pad([...webpHead("VP8 "), 0, 0, 0, 0x9d, 0x01, 0x2a, 500 & 255, 500 >> 8, 750 & 255, 750 >> 8]);
  assert.deepEqual(dimensions(b, "image/webp"), { width: 500, height: 750 });
});
test("dimensions: implausible or unknown sizes return null", () => {
  assert.equal(dimensions(png(30000, 100), "image/png"), null);
  assert.equal(dimensions(png(0, 100), "image/png"), null);
  assert.equal(dimensions(pad([0, 0, 0, 0x20, ...ascii("ftypavif")]), "image/avif"), null);
  assert.equal(dimensions(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"), null);
});
