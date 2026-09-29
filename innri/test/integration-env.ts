import { inject } from "vitest";

/**
 * Runs in each integration worker before the test file is imported, so the
 * modules that read their environment at import time (`~/db`, the Sanity
 * client) see these values and nothing from `.env.local`.
 *
 * Every test TRUNCATEs tables. The host check is what makes it impossible for
 * a stray DATABASE_URL to point that at Neon.
 */

const databaseUrl = inject("databaseUrl");

const host = new URL(databaseUrl).hostname;

if (host !== "127.0.0.1" && host !== "localhost") {
  throw new Error(`Refusing to run integration tests against ${host}: they truncate tables.`);
}

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  APP_URL: "https://app.test",
  CLERK_SECRET_KEY: "sk_test_integration",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_test_integration",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_integration",
  SANITY_PROJECT_ID: "testproject",
  SANITY_DATASET: "test",
  SANITY_READ_TOKEN: "sanity-test-token",
  SESSION_SECRET: "session-secret-for-integration-tests-only",
});
