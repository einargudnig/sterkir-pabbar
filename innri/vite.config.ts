import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],

  resolve: {
    /**
     * The `~` alias is declared explicitly rather than discovered from
     * tsconfig.
     *
     * `resolve.tsconfigPaths` walks up and also picks up the repo root's
     * tsconfig.json, which extends `astro/tsconfigs/strict`. That resolves
     * locally, where the root node_modules has Astro — but not on Vercel, where
     * this project's root directory is `innri/` and only its dependencies are
     * installed. The build then fails with "Tsconfig not found
     * astro/tsconfigs/strict", locally-green and remotely-red.
     */
    alias: {
      "~": new URL("./app/", import.meta.url).pathname,
    },

    /**
     * `@teamrepeat/card-token` is ESM with extensionless relative imports
     * (`./useCardToken`), which Node's ESM loader refuses: left external, the
     * server bundle's top-level import throws and takes every route down, not
     * just /subscribe. Bundling it lets Vite resolve the path instead.
     *
     * Under `resolve`, not `ssr`: the Vercel preset builds a server environment
     * of its own (`ssrBundle_nodejs_…`), and top-level `ssr.*` only configures
     * the default one. Every environment inherits `resolve`.
     */
    noExternal: ["@teamrepeat/card-token"],
  },

  ssr: {
    noExternal: ["@clerk/react-router"],
  },
});
