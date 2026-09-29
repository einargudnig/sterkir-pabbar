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
  },

  ssr: {
    noExternal: ["@clerk/react-router"],
  },
});
