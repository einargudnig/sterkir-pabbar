/**
 * Number formatting for Icelandic readers, without depending on the browser.
 *
 * `toLocaleString("is-IS")` cannot be trusted here. Chrome builds ship a subset
 * of ICU locale data, and where `is-IS` is missing the call does not throw — it
 * silently falls back to `en-GB` and prints "1,812" where an Icelandic reader
 * expects "1.812". The server has full ICU, so the two disagree and React
 * throws a hydration mismatch on top of showing the wrong number.
 *
 * Icelandic groups thousands with a period. These are whole kcal and whole
 * grams, so that is the entire rule.
 */
export const formatWholeNumber = (value: number): string =>
  Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/gu, ".");

const MONTHS = [
  "janúar",
  "febrúar",
  "mars",
  "apríl",
  "maí",
  "júní",
  "júlí",
  "ágúst",
  "september",
  "október",
  "nóvember",
  "desember",
] as const;

/**
 * "1. október 2026", for the same reason as above: `toLocaleDateString` would
 * differ between server and browser. Read in UTC, which is Iceland's time zone
 * all year — no daylight saving — so the date a member reads is the date it is.
 */
export const formatDate = (date: Date): string =>
  `${date.getUTCDate()}. ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
