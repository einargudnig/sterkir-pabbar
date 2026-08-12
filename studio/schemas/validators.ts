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
