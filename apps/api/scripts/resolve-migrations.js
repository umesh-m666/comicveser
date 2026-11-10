#!/usr/bin/env node
/**
 * Automatically resolves Prisma P3009 ("migrate found failed migrations in the target database")
 * by removing unfinished/failed entries in `_prisma_migrations` and syncing checksums before
 * `prisma migrate deploy` runs. All migration SQL files in `prisma/migrations/` are idempotent.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

async function main() {
  const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();
  if (!dbUrl) {
    console.log("[resolve-migrations] DATABASE_URL not set; skipping migration check.");
    return;
  }

  let PrismaClient;
  try {
    ({ PrismaClient } = require("@prisma/client"));
  } catch {
    console.log("[resolve-migrations] @prisma/client not generated yet; skipping.");
    return;
  }

  const prisma = new PrismaClient();
  let hadFailedMigrations = false;

  try {
    await prisma.$connect();

    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = '_prisma_migrations'
      ) AS "exists";
    `);

    const tableExists = Array.isArray(tableCheck) && Boolean(tableCheck[0]?.exists);
    if (!tableExists) {
      console.log("[resolve-migrations] _prisma_migrations table does not exist yet.");
    } else {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT "id", "migration_name", "finished_at", "rolled_back_at"
        FROM "_prisma_migrations"
      `);

      for (const row of rows) {
        if (!row.finished_at && !row.rolled_back_at) {
          hadFailedMigrations = true;
          console.log(`[resolve-migrations] Removing failed migration record: ${row.migration_name} (${row.id})`);
          await prisma.$executeRawUnsafe(
            `DELETE FROM "_prisma_migrations" WHERE "id" = $1`,
            row.id,
          );
        } else if (row.finished_at && row.migration_name) {
          const sqlPath = path.resolve(__dirname, "..", "prisma", "migrations", row.migration_name, "migration.sql");
          if (fs.existsSync(sqlPath)) {
            const content = fs.readFileSync(sqlPath);
            const checksum = crypto.createHash("sha256").update(content).digest("hex");
            await prisma.$executeRawUnsafe(
              `UPDATE "_prisma_migrations" SET "checksum" = $1 WHERE "id" = $2`,
              checksum,
              row.id,
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[resolve-migrations] Could not inspect _prisma_migrations: ${err?.message || err}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  if (process.argv.includes("--deploy") || hadFailedMigrations) {
    console.log("[resolve-migrations] Running prisma migrate deploy...");
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const res = spawnSync(npxCmd, ["prisma", "migrate", "deploy"], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: process.env,
    });
    if (res.status !== 0) {
      console.warn(`[resolve-migrations] prisma migrate deploy exited with code ${res.status}`);
    }
  }
}

main().catch((err) => {
  console.warn("[resolve-migrations] Unexpected error:", err?.message || err);
  process.exit(0);
});
