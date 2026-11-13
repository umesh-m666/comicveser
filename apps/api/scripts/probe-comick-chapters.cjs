const path = require("node:path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const rawHid = String(process.argv[2] || "1J46csio").trim();
const rawLang = String(process.argv[3] || "en").trim();
const SAFE_PARAM = /^[a-zA-Z0-9_-]{1,64}$/;
const hid = SAFE_PARAM.test(rawHid) ? rawHid : "1J46csio";
const language = SAFE_PARAM.test(rawLang) ? rawLang : "en";

async function main() {
  const routes = [
    { name: "fetch -> api.comick.dev", url: `https://api.comick.dev/comic/${encodeURIComponent(hid)}/chapters?page=1&limit=20&lang=${encodeURIComponent(language)}`, referer: "https://comick.dev/" },
    { name: "fetch -> api.comick.io", url: `https://api.comick.io/comic/${encodeURIComponent(hid)}/chapters?page=1&limit=20&lang=${encodeURIComponent(language)}`, referer: "https://comick.io/" },
    { name: "fetch -> comick-api-proxy", url: `https://comick-api-proxy.notaspider.dev/api/comic/${encodeURIComponent(hid)}/chapters?page=1&limit=20&lang=${encodeURIComponent(language)}`, referer: "https://comick.dev/" },
  ];

  const timeoutMs = Math.min(Math.max(Number(process.env.SOURCES_TIMEOUT_MS || 15000), 1000), 60000);

  for (const route of routes) {
    console.log(`\n=== ${route.name} ===`);
    console.log("URL:", route.url);
    try {
      const response = await fetch(route.url, {
        headers: {
          "User-Agent": "ComicVerse/1.0",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: route.referer,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.text();
      console.log("HTTP:", response.status);
      console.log("CF-Ray:", response.headers.get("cf-ray") || "(none)");
      console.log("Response:", body.replace(/\s+/g, " ").slice(0, 500));
    } catch (err) {
      console.error("Failed:", err.message);
    }
  }
}

main().catch((error) => {
  console.error("Probe failed:", error.message);
  process.exitCode = 1;
});
