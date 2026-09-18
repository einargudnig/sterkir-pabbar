import type { CustomValidator } from "sanity";

/**
 * Two rules in this file are not style preferences — they are the two ways the
 * editor can silently break something that does not show up on screen.
 */

/**
 * `Hero.astro` does `hero.headline.split(hero.emphasis)` to wrap one word in
 * italic serif. If the emphasis word is not in the headline the split returns
 * the whole string and the emphasis silently disappears; if it is empty the
 * split explodes the headline into individual characters.
 */
export const emphasisMustBeInHeadline: CustomValidator<string | undefined> = (
  emphasis,
  context,
) => {
  const headline = (context.parent as { headline?: string } | undefined)?.headline;

  if (!emphasis?.trim()) return "Áhersluorðið má ekki vera tómt.";
  if (!headline) return true; // the headline's own `required()` reports this
  if (!headline.includes(emphasis)) {
    return `Áhersluorðið verður að koma orðrétt fyrir í fyrirsögninni. „${emphasis}“ finnst ekki í „${headline}“.`;
  }
  return true;
};

/**
 * `jsonLd.ts` builds the Offer schema with `price.replace(/[^\d]/g, "")`.
 * "15.900 kr/mán" → "15900". Anything else produces structured data that is
 * wrong or empty with no visible symptom on the page:
 *   "Hafðu samband"        → ""
 *   "15.900–24.900 kr/mán" → "1590024900"
 */
const PRICE_PATTERN = /^\d{1,3}(\.\d{3})* kr\/mán$/;

export const priceMustBeMachineReadable: CustomValidator<string | undefined> = (price) => {
  if (!price) return "Verð vantar.";
  if (!PRICE_PATTERN.test(price)) {
    return "Verðið verður að vera á forminu „15.900 kr/mán“ — punktur í þúsundum, engin bil önnur en fyrir „kr/mán“. Annars birtist rangt verð í leitarniðurstöðum Google.";
  }
  return true;
};

/**
 * Exercise videos are embedded, not linked. A Google Drive or Dropbox share URL
 * looks fine in the Studio and renders as a broken player for every member, so
 * the host is checked at edit time rather than discovered in production.
 */
const EMBEDDABLE_VIDEO_HOSTS = [
  "vimeo.com",
  "player.vimeo.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
];

export const videoUrlMustBeEmbeddable: CustomValidator<string | undefined> = (url) => {
  if (!url) return true; // optional — the app shows "Myndband kemur" instead

  let host: string;

  try {
    host = new URL(url).hostname;
  } catch {
    return "Þetta er ekki gild slóð.";
  }

  if (!EMBEDDABLE_VIDEO_HOSTS.includes(host)) {
    return "Myndbandið verður að vera á Vimeo eða YouTube. Slóðir af Google Drive, Dropbox eða iCloud spilast ekki inni á síðunni.";
  }

  return true;
};

/**
 * The app finds a member's plan by querying for one exact pair of goal +
 * sessionsPerWeek. Two published plans sharing a pair means the query returns
 * both and the app shows whichever came back first — a member could get a
 * different plan than the one Aron meant, with nothing visibly wrong anywhere.
 *
 * Checked against published documents only. Two drafts may coexist while Aron
 * is still writing; the clash matters at publish time.
 */
export const planCombinationMustBeUnique: CustomValidator<string | undefined> = async (
  goal,
  context,
) => {
  const parent = context.parent as { sessionsPerWeek?: number } | undefined;
  const frequency = parent?.sessionsPerWeek;

  if (!goal || typeof frequency !== "number") return true; // their own `required()` reports this

  const id = context.document?._id;

  if (!id) return true;

  const publishedId = id.replace(/^drafts\./, "");
  const client = context.getClient({ apiVersion: "2024-01-01" });

  const clash = await client.fetch<string | null>(
    `*[_type == "trainingPlan" && goal == $goal && sessionsPerWeek == $frequency && !(_id in $ids)][0].title`,
    { goal, frequency, ids: [publishedId, `drafts.${publishedId}`] },
  );

  if (clash) {
    return `Það er þegar til plan fyrir þessa samsetningu: „${clash}“. Hver samsetning af markmiði og tíðni má aðeins eiga eitt plan.`;
  }

  return true;
};
