/**
 * One-time seed: pushes the current `src/content/content.json` into Sanity as
 * the single `siteContent` document.
 *
 * Without this you would retype two packages, six FAQ entries, three method
 * steps and four bullet points into an empty Studio by hand, in Icelandic,
 * with a real chance of a typo landing in the structured data.
 *
 * Run once, after creating the Sanity project:
 *   SANITY_PROJECT_ID=… SANITY_WRITE_TOKEN=… node scripts/seed-sanity.mjs
 *
 * Safe to re-run: it uses createOrReplace, so it overwrites the document with
 * whatever is in content.json. That also makes it a "reset to the version in
 * git" button if an edit ever needs undoing.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/content/content.json", import.meta.url));

const PROJECT_ID = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET ?? "production";
const TOKEN = process.env.SANITY_WRITE_TOKEN;
const API_VERSION = "2024-10-01";

if (!PROJECT_ID || !TOKEN) {
  console.error(
    "[seed] SANITY_PROJECT_ID and SANITY_WRITE_TOKEN are both required.\n" +
      "[seed] Create the token at https://sanity.io/manage → API → Tokens (Editor).",
  );
  process.exit(1);
}

const content = JSON.parse(await readFile(SRC, "utf8"));

/**
 * Sanity needs a stable `_key` on every object inside an array, and a `_type`
 * matching the array member name declared in the schema. Arrays of plain
 * strings (features, points, paragraphs) need neither.
 */
const keyed = (items, type) =>
  items.map((item, index) => ({ ...item, _type: type, _key: `${type}-${index}` }));

const doc = {
  _id: "siteContent",
  _type: "siteContent",
  hero: content.hero,
  offeringsTitle: content.offeringsTitle,
  offeringsLead: content.offeringsLead,
  offerings: keyed(content.offerings, "offering"),
  method: { ...content.method, steps: keyed(content.method.steps, "step") },
  forDads: content.forDads,
  coachIntro: content.coachIntro,
  faqTitle: content.faqTitle,
  faq: keyed(content.faq, "faqItem"),
  finalCta: content.finalCta,
  general: content.general,
  contact: content.contact,
  coach: content.coach,
  social: content.social,
};

const res = await fetch(
  `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ mutations: [{ createOrReplace: doc }] }),
  },
);

if (!res.ok) {
  console.error(`[seed] Sanity returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}

console.log("[seed] Seeded `siteContent`. Open the Studio and hit Publish.");
