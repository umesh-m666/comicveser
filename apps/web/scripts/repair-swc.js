const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

if (process.platform === "win32" && process.arch === "x64") {
  const swcDir = path.join(__dirname, "..", "node_modules", "@next", "swc-win32-x64-msvc");
  const swcBin = path.join(swcDir, "next-swc.win32-x64-msvc.node");
  if (fs.existsSync(swcBin)) {
    let corrupted = false;
    try {
      const stat = fs.statSync(swcBin);
      if (stat.size < 10 * 1024 * 1024) {
        corrupted = true;
      } else {
        const fd = fs.openSync(swcBin, "r");
        const buf = Buffer.alloc(2);
        fs.readSync(fd, buf, 0, 2, 0);
        fs.closeSync(fd);
        if (buf.toString("ascii") !== "MZ") {
          corrupted = true;
        } else {
          // Test loading the native addon
          require(swcBin);
        }
      }
    } catch (err) {
      if (err && /not a valid Win32 application|ERR_DLOPEN_FAILED/i.test(String(err.message || err))) {
        corrupted = true;
      }
    }

    if (corrupted) {
      console.warn("[repair-swc] Detected corrupted @next/swc-win32-x64-msvc binary (caused by previous disk-full install). Repairing...");
      try {
        fs.rmSync(swcDir, { recursive: true, force: true });
        execSync("npm i --no-save @next/swc-win32-x64-msvc@14.2.5", {
          cwd: path.join(__dirname, ".."),
          stdio: "inherit",
        });
        console.log("[repair-swc] Successfully repaired @next/swc-win32-x64-msvc.");
      } catch (repairErr) {
        console.error("[repair-swc] Automatic repair failed. Please run manually in apps/web:");
        console.error("  Remove-Item -Recurse -Force node_modules\@next\swc-win32-x64-msvc; npm install --force");
      }
    }
  }
}
