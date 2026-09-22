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
