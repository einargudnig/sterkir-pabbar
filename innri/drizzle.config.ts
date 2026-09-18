import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated into ./drizzle and applied with `bun run db:migrate`.
 *
 * Generation does not need a database — `bun run db:generate` works offline
 * from the schema alone, which is why the schema could land before Neon existed.
 * Everything else here needs DATABASE_URL.
 */
export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  /**
   * Migrations use the UNPOOLED connection. DDL through Neon's PgBouncer pooler
   * can fail or hang — the pooler is for short application queries, not schema
   * changes. Falls back to the pooled URL so a local run without the unpooled
   * var still works.
   */
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
