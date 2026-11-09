const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const hid = process.argv[2] || "1J46csio";
const language = process.argv[3] || "en";

async function tryGotScraping(url, referer) {
  const dynamicImport = new Function("specifier", "return import(specifier)");
  const vendorPath = path.resolve(__dirname, "../vendor/node_modules/got-scraping/dist/index.js");
  if (!fs.existsSync(vendorPath)) return null;
  const { gotScraping } = await dynamicImport(pathToFileURL(vendorPath).href);
  const res = await gotScraping({
    url,
    headerGeneratorOptions: {
      browsers: [{ name: "chrome", minVersion: 120 }],
      operatingSystems: ["windows"],
      locales: ["en-US", "en"],
    },
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: new URL(referer).origin,
      Referer: referer,
    },
    retry: { limit: 1 },
    timeout: { request: Number(process.env.SOURCES_TIMEOUT_MS || 15000) },
    throwHttpErrors: false,
  });
  return { status: res.statusCode, cfRay: res.headers["cf-ray"], body: res.body };
}

async function main() {
  const routes = [
    { name: "got-scraping -> api.comick.dev", url: `https://api.comick.dev/comic/${encodeURIComponent(hid)}/chapters?page=1&limit=20&lang=${encodeURIComponent(language)}`, referer: "https://comick.dev/", useGot: true },
    { name: "got-scraping -> api.comick.io", url: `https://api.comick.io/comic/${encodeURIComponent(hid)}/chapters?page=1&limit=20&lang=${encodeURIComponent(language)}`, referer: "https://comick.io/", useGot: true },
    { name: "fetch -> comick-api-proxy", url: `https://comick-api-proxy.notaspider.dev/api/comic/${encodeURIComponent(hid)}/chapters?page=1&limit=20&lang=${encodeURIComponent(language)}`, referer: "https://comick.dev/", useGot: false },
  ];

  for (const route of routes) {
    console.log(`\n=== ${route.name} ===`);
    console.log("URL:", route.url);
    try {
      if (route.useGot) {
        const res = await tryGotScraping(route.url, route.referer);
        if (res) {
          console.log("HTTP:", res.status);
          console.log("CF-Ray:", res.cfRay || "(none)");
          console.log("Response:", String(res.body).replace(/\s+/g, " ").slice(0, 500));
          continue;
        }
      }
      const response = await fetch(route.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: route.referer,
        },
        signal: AbortSignal.timeout(Number(process.env.SOURCES_TIMEOUT_MS || 15000)),
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
