#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function getMigrationNames() {
  const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function runPrisma(args) {
  return spawnSync("npx", ["prisma", ...args], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}

function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[migrations] DATABASE_URL not set; skipping migration deploy.");
    return;
  }
  const firstAttempt = runPrisma(["migrate", "deploy"]);
  if (firstAttempt.stdout) process.stdout.write(firstAttempt.stdout);
  if (firstAttempt.stderr) process.stderr.write(firstAttempt.stderr);
  if (firstAttempt.status === 0) return;

  const combined = `${firstAttempt.stdout || ""}\n${firstAttempt.stderr || ""}`;
  if (combined.includes("P3009") || combined.includes("P3018") || combined.includes("failed migrations")) {
    console.log("[migrations] Detected failed migration state in _prisma_migrations. Resolving rolled-back entries...");
    for (const name of getMigrationNames()) {
      runPrisma(["migrate", "resolve", "--rolled-back", name]);
    }
    const retry = runPrisma(["migrate", "deploy"]);
    if (retry.stdout) process.stdout.write(retry.stdout);
    if (retry.stderr) process.stderr.write(retry.stderr);
    if (retry.status === 0) return;
    process.exit(retry.status || 1);
  }
  process.exit(firstAttempt.status || 1);
}

main();
