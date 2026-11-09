// Run from apps/api with: node scripts/test-comick-node.cjs
// Uses the same Node fetch runtime and request headers as ComicVerse.
const path = require("node:path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const base = "https://api.comick.dev/v1.0/search";
const userAgent = process.env.SOURCES_USER_AGENT || "ComicVerse/1.0 (+http://localhost:3000)";
const checks = [
  { name: "plain search (same basic endpoint as curl)", params: { q: "naruto", page: "1", limit: "1" } },
  { name: "manga filter (country=jp, used when type=manga)", params: { q: "naruto", page: "1", limit: "1", country: "jp" } },
  { name: "health probe (q=comic)", params: { q: "comic", page: "1", limit: "1" } },
];

function errorDetails(error) {
  const rows = [];
  let current = error;
  for (let depth = 0; current && depth < 4; depth++, current = current.cause) {
    rows.push({ name: current.name, message: current.message, code: current.code });
  }
  return rows;
}

(async () => {
  console.log(`Node: ${process.version}`);
  console.log(`User-Agent: ${userAgent}`);
  for (const check of checks) {
    const url = new URL(base);
    for (const [key, value] of Object.entries(check.params)) url.searchParams.set(key, value);
    console.log(`\n--- ${check.name} ---`);
    console.log(url.toString());
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://comick.dev/",
        },
        signal: AbortSignal.timeout(Number(process.env.SOURCES_TIMEOUT_MS || 10000)),
      });
      const body = await response.text();
      console.log(`HTTP ${response.status} ${response.statusText}`);
      console.log(`Server: ${response.headers.get("server") || "(not supplied)"}`);
      console.log(`CF-Ray: ${response.headers.get("cf-ray") || "(not supplied)"}`);
      console.log(`Body: ${body.replace(/\s+/g, " ").slice(0, 350)}`);
    } catch (error) {
      console.log("NODE FETCH FAILED:");
      console.log(JSON.stringify(errorDetails(error), null, 2));
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
