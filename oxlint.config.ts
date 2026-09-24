import { defineConfig } from "oxlint";

/**
 * One linter, three rule sets. See docs/solutions/agent-tooling.md.
 *
 *   built-in   correctness / suspicious / perf        — everywhere
 *   anti-slop  rejects low-evidence TypeScript         — innri/ only
 *   shadcn     rejects styling outside the design tokens — innri/ only
 *
 * Replaces the former .oxlintrc.json: anti-slop is a local JS plugin, which the
 * JSON format cannot express.
 */
export default defineConfig({
  plugins: ["import", "typescript"],

  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    "@shadcn/lint",
  ],

  categories: {
    correctness: "error",
    suspicious: "warn",
    perf: "warn",
  },

  rules: {
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
  },

  /**
   * The strict rule sets apply to new code only.
   *
   * Enabling them repo-wide surfaces ~44 pre-existing violations in the Astro
   * site and the Studio, almost all `require-readable-spacing`. Fixing those is
   * worthwhile cleanup but it is not in the critical path of a paid build, and a
   * wall of errors an agent is told to ignore is worse than no wall at all.
   *
   * So the members' area is held to the full standard from its first line, and
   * the existing site keeps the baseline categories until someone does that
   * cleanup deliberately.
   */
  overrides: [
    {
      files: ["innri/**"],
      rules: {
        // anti-slop. Effect rules exist under tools/oxlint/anti-slop/effect/ but
        // are deliberately not registered — this project does not use Effect.
        "anti-slop/no-array-filter-map": "error",
        "anti-slop/no-chained-type-assertions": "error",
        "anti-slop/no-conditional-empty-object-spread": "error",
        "anti-slop/no-known-value-widening": "error",
        "anti-slop/no-module-mocking": "error",
        "anti-slop/no-object-parameters": "error",
        "anti-slop/no-reduce-accumulator-copy": "error",
        "anti-slop/no-reflect-apply": "error",
        "anti-slop/no-reflect-get": "error",
        "anti-slop/no-runtime-typeof": "error",
        "anti-slop/no-shape-in-symbol-names": "error",
        "anti-slop/no-unknown-parameters": "error",
        "anti-slop/no-unknown-returns": "error",
        "anti-slop/no-unknown-type-aliases": "error",
        "anti-slop/no-unsafe-dictionary-type": "error",
        "anti-slop/no-widen-then-assert": "error",
        "anti-slop/require-readable-spacing": "error",
        "anti-slop/require-safety-comment-for-type-assertion": "error",

        // shadcn design system, enforced against the @theme block copied from
        // src/styles/global.css. Only fires on JSX/TSX.
        "shadcn/no-restyle": ["error", { allow: ["layout"] }],
        "shadcn/no-arbitrary-values": "error",
        "shadcn/no-inline-styles": "error",
        /**
         * Tailwind shares the `text-` prefix between font size and text colour,
         * so the five `--text-*` size tokens in the theme read as undeclared
         * colours. Allow exactly those five — not `text-*`, which would let the
         * whole raw palette back in.
         */
        "shadcn/no-raw-colors": [
          "error",
          {
            allow: ["text-hero", "text-display", "text-title", "text-subtitle", "text-lead"],
          },
        ],
        "shadcn/no-unknown-classes": "error",
      },
    },

    /**
     * Vendored shadcn registry components *are* the design system rather than
     * consumers of it, so the design rules do not apply: their variants build
     * values the token scale cannot express, e.g.
     * `rounded-[min(var(--radius-md),10px)]`.
     *
     * anti-slop stays on deliberately. These files get edited by hand often
     * enough that TypeScript soundness still matters, and a vendored component
     * that trips it is worth looking at rather than silencing.
     */
    {
      files: ["innri/app/components/ui/**"],
      rules: {
        "shadcn/no-restyle": "off",
        "shadcn/no-arbitrary-values": "off",
        "shadcn/no-inline-styles": "off",
        "shadcn/no-raw-colors": "off",
        "shadcn/no-unknown-classes": "off",
      },
    },
  ],

  ignorePatterns: [
    "**/node_modules/**",
    "dist/",
    "innri/build/**",
    "innri/.react-router/**",
    "innri/coverage/**",
    "**/*.d.ts",
    ".agents/",
    ".impeccable/",
    ".claude/",
    "tools/oxlint/anti-slop/**",
    "innri/app/lib/sanity.types.ts",
  ],
});
