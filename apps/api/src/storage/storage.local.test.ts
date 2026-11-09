import { randomUUID } from "crypto";
import { rm } from "fs/promises";
import { resolve } from "path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { StorageService } from "./storage.service";

function png() {
  const image = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(image);
  image.writeUInt32BE(10, 16);
  image.writeUInt32BE(20, 20);
  return image;
}

test("local chapter storage accepts its upload link, verifies the image and serves it", async () => {
  const keys = ["NODE_ENV", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.NODE_ENV = "test";
  for (const key of keys.slice(1)) delete process.env[key];

  const testChapter = `local-test-${randomUUID()}`;
  const key = `chapters/${testChapter}/page.png`;
  const service = new StorageService();

  try {
    const uploadUrl = await service.presignPut(key, "image/png");
    const token = new URL(uploadUrl).pathname.split("/").pop();
    assert.ok(token);
    await service.acceptLocalUpload(token, "image/png", png());

    const inspected = await service.inspect(key);
    assert.equal(inspected.width, 10);
    assert.equal(inspected.height, 20);
    const stored = await service.readLocalFile(key);
    assert.equal(stored.mime, "image/png");
    assert.deepEqual(stored.body, png());
    await assert.rejects(service.acceptLocalUpload(token, "image/png", png()));
  } finally {
    await service.remove(key);
    await rm(resolve(__dirname, "../../uploads", "chapters", testChapter), { recursive: true, force: true });
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
