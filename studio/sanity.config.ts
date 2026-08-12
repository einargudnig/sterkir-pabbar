import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";

import { schemaTypes } from "./schemas";

/**
 * The whole landing page is ONE document (`siteContent`, fixed id).
 *
 * A one-page site modelled as many documents gives the editor a list to
 * navigate and a way to create orphans. A single document with field groups
 * gives him tabs — Hero, Pakkar, Um mig — and no way to end up somewhere the
 * page does not render.
 */
const SINGLETON_ID = "siteContent";

export default defineConfig({
  name: "sterkir-pabbar",
  title: "Sterkir pabbar",

  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Efni")
          .items([
            S.listItem()
              .title("Efni síðunnar")
              .id(SINGLETON_ID)
              .child(S.document().schemaType(SINGLETON_ID).documentId(SINGLETON_ID)),
          ]),
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    // Nothing on this site is creatable from the "+" button — there is exactly
    // one document and it already exists.
    templates: (prev) => prev.filter((t) => t.schemaType !== SINGLETON_ID),
  },

  document: {
    // Remove duplicate/delete from the singleton so the page can never lose
    // its only source of content.
    actions: (prev, { schemaType }) =>
      schemaType === SINGLETON_ID
        ? prev.filter(
            ({ action }) => action && !["unpublish", "delete", "duplicate"].includes(action),
          )
        : prev,
  },
});
