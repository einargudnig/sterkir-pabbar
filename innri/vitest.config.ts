import { defineConfig } from "vitest/config";

/**
 * Deliberately does not load the React Router vite plugin — these are unit
 * tests over pure modules, not route rendering. The one end-to-end path is a
 * Playwright smoke test, added in phase 8.
 *
 * Coverage thresholds apply only to the modules that carry real risk. See
 * docs/solutions/inner-circle.md — chasing repo-wide coverage is explicitly
 * rejected.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
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
  resolve: {
    alias: {
      "~": new URL("./app/", import.meta.url).pathname,
    },
  },
});
