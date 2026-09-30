import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";

import { schemaTypes } from "./schemas";
import { MUSCLE_GROUPS } from "./schemas/exercise";
import { planTemplates } from "./schemas/splits";

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
            S.divider(),
            S.listItem()
              .title("Æfingar")
              .schemaType("exercise")
              .child(
                S.list()
                  .title("Æfingar")
                  .items([
                    ...MUSCLE_GROUPS.map((group) =>
                      S.listItem()
                        .id(`exercise-${group.value}`)
                        .title(group.title)
                        .schemaType("exercise")
                        .child(
                          S.documentTypeList("exercise")
                            .title(group.title)
                            .filter('_type == "exercise" && muscleGroup == $group')
                            .params({ group: group.value })
                            .initialValueTemplates([
                              S.initialValueTemplateItem("exercise-in-group", {
                                muscleGroup: group.value,
                              }),
                            ]),
                        ),
                    ),
                    S.divider(),
                    S.documentTypeListItem("exercise").title("Allar æfingar"),
                  ]),
              ),
            S.documentTypeListItem("trainingPlan"),
            S.documentTypeListItem("article"),
          ]),
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    // Nothing on this site is creatable from the "+" button — there is exactly
    // one document and it already exists.
    templates: (prev) => [
      ...prev.filter((t) => t.schemaType !== SINGLETON_ID),
      ...planTemplates,
      /** Used by the muscle-group folders: a new exercise starts in its folder's group. */
      {
        id: "exercise-in-group",
        title: "Æfing í vöðvahópi",
        schemaType: "exercise",
        parameters: [{ name: "muscleGroup", type: "string" }],
        value: (params: { muscleGroup: string }) => ({ muscleGroup: params.muscleGroup }),
      },
    ],
  },

  document: {
    // The folder template only makes sense inside a muscle-group folder, which
    // fills in its group; the plain "Æfing" stays in the global "+" menu.
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === "global"
        ? prev.filter((item) => item.templateId !== "exercise-in-group")
        : prev,
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
