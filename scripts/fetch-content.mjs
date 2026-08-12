/**
 * Pulls the published content from Sanity into `src/content/content.json`
 * before every build.
 *
 * Design rules, in priority order:
 *
 * 1. NEVER fail the build. The committed content.json is a complete, valid copy
 *    of the site's copy. If Sanity is down, unreachable, unconfigured, or
 *    returns something malformed, we log loudly and build from the file that is
 *    already in the repo. A CMS outage must not stop you shipping a CSS fix.
 * 2. NEVER write something the page cannot render. The two invariants that
 *    break silently — the emphasis word and the machine-readable price — are
 *    re-checked here, because Sanity's validation is enforced in the editor and
 *    a direct API write could bypass it.
 *
 * Uses plain fetch against Sanity's HTTP query API so the site itself needs no
 * dependencies at all.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../src/content/content.json", import.meta.url));

/**
 * `bun run build` autoloads `.env` for processes bun starts, but this script is
 * spawned as a `node` child, which does not inherit that. Without this the
 * whole integration is a silent no-op locally: the build succeeds, and quietly
 * never contacts Sanity at all.
 *
 * Missing `.env` is the normal case in CI, where the host injects real
 * environment variables — so its absence is not an error.
 */
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // No .env — expected on the build host.
}

const PROJECT_ID = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET ?? "production";
const API_VERSION = "2024-10-01";

/**
 * Explicit projections rather than a bare `*[...][0]` so the result is exactly
 * the shape content.json already has — no `_key`, `_type` or `_rev` noise to
 * strip, and a renamed field in Sanity shows up as a missing key here instead
 * of quietly flowing through.
 */
const QUERY = `*[_type == "siteContent"][0]{
  hero{headline, emphasis, sub, primaryCtaLabel, secondaryCtaLabel},
  offeringsTitle,
  offeringsLead,
  offerings[]{name, tag, price, summary, features, featured},
  method{title, intro, steps[]{n, title, body}},
  forDads{title, points},
  coachIntro{title, paragraphs},
  faqTitle,
  faq[]{q, a},
  finalCta{title, body, ctaLabel},
  general{tagline, description},
  contact{email, phone, city},
  coach{name, role, bio, credentials},
  social{instagram, facebook}
}`;

const REQUIRED_KEYS = [
  "hero",
  "offeringsTitle",
  "offeringsLead",
  "offerings",
  "method",
  "forDads",
  "coachIntro",
  "faqTitle",
  "faq",
  "finalCta",
  "general",
  "contact",
  "coach",
];

const PRICE_PATTERN = /^\d{1,3}(\.\d{3})* kr\/mán$/;

/** Returns a list of human-readable problems; empty means the payload is safe. */
const validate = (c) => {
  const problems = [];

  for (const key of REQUIRED_KEYS) {
    if (c[key] === null || c[key] === undefined) problems.push(`missing "${key}"`);
  }
  if (problems.length) return problems;

  // Hero.astro splits the headline on the emphasis word.
  if (!c.hero.emphasis || !c.hero.headline?.includes(c.hero.emphasis)) {
    problems.push(
      `hero.emphasis "${c.hero.emphasis}" does not occur in hero.headline "${c.hero.headline}"`,
    );
  }

  if (!Array.isArray(c.offerings) || c.offerings.length === 0) {
    problems.push("offerings is empty");
  } else {
    // jsonLd.ts parses the digits out of these for the Offer schema.
    for (const o of c.offerings) {
      if (!PRICE_PATTERN.test(o.price ?? "")) {
        problems.push(`offering "${o.name}" has an unparseable price: "${o.price}"`);
      }
      if (!Array.isArray(o.features) || o.features.length === 0) {
        problems.push(`offering "${o.name}" has no features`);
      }
    }
    // Offerings.astro renders one featured panel; two would silently drop one.
    const featured = c.offerings.filter((o) => o.featured).length;
    if (featured !== 1) {
      problems.push(`exactly one offering must be featured, found ${featured}`);
    }
  }

  if (!Array.isArray(c.faq) || c.faq.length === 0) problems.push("faq is empty");
  if (!Array.isArray(c.method?.steps) || c.method.steps.length === 0) {
    problems.push("method.steps is empty");
  }
  if (!Array.isArray(c.forDads?.points) || c.forDads.points.length === 0) {
    problems.push("forDads.points is empty");
  }
  if (!Array.isArray(c.coachIntro?.paragraphs) || c.coachIntro.paragraphs.length === 0) {
    problems.push("coachIntro.paragraphs is empty");
  }

  return problems;
};

const keepExisting = (reason) => {
  console.warn(`[content] ${reason}`);
  console.warn("[content] Building from the committed src/content/content.json.");
  process.exit(0);
};

if (!PROJECT_ID) {
  keepExisting("SANITY_PROJECT_ID is not set.");
}

const url =
  `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}` +
  `?query=${encodeURIComponent(QUERY)}`;

let payload;
try {
  const res = await fetch(url, {
    headers: {
      // Only needed if the dataset is private. Public datasets ignore it.
      ...(process.env.SANITY_READ_TOKEN
        ? { Authorization: `Bearer ${process.env.SANITY_READ_TOKEN}` }
        : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    keepExisting(`Sanity returned ${res.status} ${res.statusText}.`);
  }
  payload = (await res.json()).result;
} catch (error) {
  keepExisting(`Could not reach Sanity: ${error.message}`);
}

if (!payload) {
  keepExisting("Sanity has no published `siteContent` document yet.");
}

const problems = validate(payload);
if (problems.length) {
  console.warn("[content] Rejected the payload from Sanity:");
  for (const problem of problems) console.warn(`[content]   • ${problem}`);
  keepExisting("Content from Sanity failed validation.");
}

/**
 * Sanity's query API returns object keys alphabetically, ignoring the order
 * they are written in the projection above. Left alone, the first build would
 * reshuffle all 126 lines of content.json into alphabetical order and every
 * later real edit would land in a file that no longer reads in page order.
 *
 * So the committed file is the template: keys come back in the order they
 * already have on disk, and anything genuinely new is appended at the end
 * rather than silently dropped.
 */
const orderLike = (template, value) => {
  if (Array.isArray(value)) {
    return value.map((item, index) => orderLike(template?.[index] ?? template?.[0], item));
  }
  if (value === null || typeof value !== "object") return value;

  const templateKeys = Object.keys(template ?? {}).filter((k) => k in value);
  const newKeys = Object.keys(value).filter((k) => !templateKeys.includes(k));

  return Object.fromEntries(
    [...templateKeys, ...newKeys].map((k) => [k, orderLike(template?.[k], value[k])]),
  );
};

const current = await readFile(OUT, "utf8").catch(() => "");
const template = current ? JSON.parse(current) : {};
const next = `${JSON.stringify(orderLike(template, payload), null, 2)}\n`;

if (next === current) {
  console.log("[content] Already up to date with Sanity.");
} else {
  await writeFile(OUT, next, "utf8");
  console.log("[content] Updated src/content/content.json from Sanity.");
}
