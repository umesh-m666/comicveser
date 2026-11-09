import { test } from "node:test";
import assert from "node:assert/strict";
import { createSourceProviders } from "./sources.module";
import { loadSourcesConfig } from "./sources.config";

test("registers ComicK alongside WeebCentral and Asura Scans only when enabled", () => {
  const enabled = createSourceProviders(loadSourcesConfig({ SOURCES_ENABLED: "true" }));
  assert.deepEqual(enabled.map((provider) => provider.id), ["weebcentral", "asurascans", "comick"]);
  assert.deepEqual(enabled.find((provider) => provider.id === "comick")?.info().capabilities.types, ["manga", "manhwa", "manhua"]);
  assert.deepEqual(createSourceProviders(loadSourcesConfig({})), []);
});
