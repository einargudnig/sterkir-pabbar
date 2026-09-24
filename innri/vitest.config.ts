import { defineConfig } from "vitest/config";

/**
 * Deliberately does not load the React Router vite plugin — these tests call
 * modules, loaders and actions directly, they do not render routes. The one
 * end-to-end path is a Playwright smoke test, added in phase 8.
 *
 * Two projects:
 *
 *   unit          pure modules, no I/O, `*.test.ts`
 *   integration   `*.integration.test.ts`, against a throwaway Postgres started
 *                 by test/postgres.ts, with Repeat and Sanity faked at their
 *                 wire boundary. One file at a time: they share the database.
 *
 * Coverage thresholds apply only to the modules that carry real risk. See
 * docs/solutions/inner-circle.md — chasing repo-wide coverage is explicitly
 * rejected.
 */

const alias = { "~": new URL("./app/", import.meta.url).pathname };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["app/**/*.test.ts"],
          exclude: ["app/**/*.integration.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["app/**/*.integration.test.ts"],
          globalSetup: ["test/postgres.ts"],
          setupFiles: ["test/integration-env.ts"],
          fileParallelism: false,
          unstubGlobals: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["app/lib/**/*.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
