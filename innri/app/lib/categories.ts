/**
 * Studio values → what a member actually reads.
 *
 * Deliberately NOT in `sanity.server.ts`. Components render these, components
 * run on the client, and importing anything from a `.server` module into client
 * code fails the build with "Server-only module referenced by client".
 *
 * `satisfies` rather than an annotation keeps the literal keys, so adding a
 * category in `studio/schemas/article.ts` without adding its label here is a
 * type error rather than a raw slug shown to a member.
 */
export const CATEGORY_LABELS = {
  "ad-byrja": "Að byrja",
  matarraedi: "Mataræði",
  "ad-halda-afram": "Að halda áfram",
  taekni: "Tækni og æfingar",
  endurheimt: "Svefn og endurheimt",
} satisfies Record<string, string>;
