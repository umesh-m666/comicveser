"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaModule = exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    async onModuleInit() {
        await this.$connect();
        try {
            await this.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SourceTitleRole') THEN
            CREATE TYPE "SourceTitleRole" AS ENUM ('PRIMARY', 'CHAPTER_FALLBACK');
          END IF;
        END $$;
      `);
            await this.$executeRawUnsafe(`
        ALTER TABLE "SourceTitle" ADD COLUMN IF NOT EXISTS "role" "SourceTitleRole" NOT NULL DEFAULT 'PRIMARY';
      `);
            await this.$executeRawUnsafe(`
        DROP INDEX IF EXISTS "SourceTitle_comicId_key";
      `);
            await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "SourceTitle_comicId_sourceId_key" ON "SourceTitle"("comicId", "sourceId");
      `);
            // Ensure any soft-deleted comic is marked ARCHIVED so it never appears as PUBLISHED.
            await this.$executeRawUnsafe(`
        UPDATE "Comic"
        SET "publishState" = 'ARCHIVED'
        WHERE "deletedAt" IS NOT NULL AND "publishState" <> 'ARCHIVED';
      `);
            // Archive orphaned provider-imported comics whose SourceTitle rows were detached or deleted.
            await this.$executeRawUnsafe(`
        UPDATE "Comic" c
        SET "deletedAt" = COALESCE(c."deletedAt", NOW()),
            "publishState" = 'ARCHIVED',
            "slug" = CASE
              WHEN c."slug" LIKE '%-deleted-%' THEN c."slug"
              ELSE LEFT(c."slug", 160) || '-deleted-' || RIGHT(c."id", 8)
            END
        WHERE c."deletedAt" IS NULL
          AND (
            c."externalCoverUrl" IS NOT NULL
            OR c."slug" ~ '-(comick|weebcentral|asurascans|mangadex)-'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "SourceTitle" st WHERE st."comicId" = c."id"
          );
      `);
            // Deduplicate multiple active comics sharing the same normalized title (including "Official " prefix),
            // keeping only the newest active Comic row per title.
            await this.$executeRawUnsafe(`
        WITH ranked AS (
          SELECT "id",
                 ROW_NUMBER() OVER (
                   PARTITION BY REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM("title")), '^official\\s+', ''), '[^a-z0-9]+', '', 'g')
                   ORDER BY "createdAt" DESC, "updatedAt" DESC, "id" DESC
                 ) AS rn
          FROM "Comic"
          WHERE "deletedAt" IS NULL
        )
        DELETE FROM "SourceTitle"
        WHERE "comicId" IN (SELECT "id" FROM ranked WHERE rn > 1);
      `);
            await this.$executeRawUnsafe(`
        WITH ranked AS (
          SELECT "id",
                 ROW_NUMBER() OVER (
                   PARTITION BY REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM("title")), '^official\\s+', ''), '[^a-z0-9]+', '', 'g')
                   ORDER BY "createdAt" DESC, "updatedAt" DESC, "id" DESC
                 ) AS rn
          FROM "Comic"
          WHERE "deletedAt" IS NULL
        )
        UPDATE "Comic" c
        SET "deletedAt" = NOW(),
            "publishState" = 'ARCHIVED',
            "slug" = CASE
              WHEN c."slug" LIKE '%-deleted-%' THEN c."slug"
              ELSE LEFT(c."slug", 160) || '-deleted-' || RIGHT(c."id", 8)
            END
        WHERE c."id" IN (SELECT "id" FROM ranked WHERE rn > 1);
      `);
        }
        catch {
            // Standard migration file is also present in prisma/migrations.
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
    get hasSourceTitlesPlural() {
        try {
            const runtimeModels = this._runtimeDataModel?.models;
            if (runtimeModels?.Comic?.fields) {
                return runtimeModels.Comic.fields.some((f) => f.name === "sourceTitles");
            }
            const dmmfModels = client_1.Prisma.dmmf?.datamodel?.models;
            if (Array.isArray(dmmfModels)) {
                const comicModel = dmmfModels.find((m) => m.name === "Comic");
                return !!comicModel?.fields?.some((f) => f.name === "sourceTitles");
            }
        }
        catch {
            // Fall back to singular relation filter
        }
        return false;
    }
    get publicComicOrFilter() {
        if (this.hasSourceTitlesPlural) {
            return [
                { externalCoverUrl: null, sourceTitles: { none: {} } },
                { sourceTitles: { some: { state: "APPROVED" } } },
            ];
        }
        return [
            { externalCoverUrl: null, sourceTitle: { is: null } },
            { sourceTitle: { is: { state: "APPROVED" } } },
        ];
    }
    async setSourceTitleRole(id, role, client = this) {
        try {
            await client.$executeRawUnsafe(`UPDATE "SourceTitle" SET "role" = $1::"SourceTitleRole" WHERE "id" = $2`, role, id);
        }
        catch {
            // Ignore if column migration has not run in test mock
        }
    }
    async getSourceTitleRolesByIds(ids, client = this) {
        if (!ids.length)
            return new Map();
        try {
            const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
            const rows = await client.$queryRawUnsafe(`SELECT "id", "role"::text AS "role" FROM "SourceTitle" WHERE "id" IN (${placeholders})`, ...ids);
            return new Map(rows.map((r) => [r.id, r.role === "CHAPTER_FALLBACK" ? "CHAPTER_FALLBACK" : "PRIMARY"]));
        }
        catch {
            return new Map(ids.map((id) => [id, "PRIMARY"]));
        }
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)()
], PrismaService);
let PrismaModule = class PrismaModule {
};
exports.PrismaModule = PrismaModule;
exports.PrismaModule = PrismaModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({ providers: [PrismaService], exports: [PrismaService] })
], PrismaModule);
//# sourceMappingURL=prisma.service.js.map