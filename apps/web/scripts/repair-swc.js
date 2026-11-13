const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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
        }
      }
    } catch {
      corrupted = true;
    }

    if (corrupted) {
      console.warn("[repair-swc] Detected truncated @next/swc-win32-x64-msvc binary. Reinstalling cleanly...");
      try {
        fs.rmSync(swcDir, { recursive: true, force: true });
        spawnSync("npm", ["i", "--no-save", "@next/swc-win32-x64-msvc"], {
          cwd: path.join(__dirname, ".."),
          stdio: "inherit",
          shell: false,
        });
      } catch {
        console.error("[repair-swc] Automatic repair failed. Remove node_modules/@next/swc-win32-x64-msvc and run npm install.");
      }
    }
  }
}
