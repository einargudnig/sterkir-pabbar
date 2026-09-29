/**
 * Icelandic national id numbers, as typed by a member on a phone.
 *
 * Aron sends each member a claim (krafa) in their online bank, and a claim is
 * addressed to a kennitala. A typo is not caught by the bank until the claim
 * silently goes to nobody — or to somebody else — so the check digit is
 * verified here, at the one moment the member can still fix it.
 *
 * Plain module, not `.server`: the wizard's input could reuse it for instant
 * feedback, and nothing here touches a secret.
 */

const WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * "010130-2989", "010130 2989" and "0101302989" are the same person. Returns
 * the ten digits, or null for anything that is not ten digits once the usual
 * separators are gone.
 */
export const normalizeKennitala = (input: string): string | null => {
  const digits = input.trim().replace(/[\s-]/gu, "");

  return /^\d{10}$/u.test(digits) ? digits : null;
};

/**
 * Whether the ninth digit matches the first eight.
 *
 * Each of the first eight digits is multiplied by its weight in `WEIGHTS` and
 * the products summed. The check digit is 11 minus (sum mod 11), where a result
 * of 11 means 0 and a result of 10 means no valid kennitala has these first
 * eight digits at all.
 *
 * `digits` is always the output of `normalizeKennitala` — ten digit characters.
 */
export const hasValidCheckDigit = (digits: string): boolean => {
  const sum = WEIGHTS.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);

  const check = 11 - (sum % 11);

  return check !== 10 && (check === 11 ? 0 : check) === Number(digits[8]);
};

/**
 * Personal, not a company: a person's kennitala starts with their day of
 * birth, 01–31, and a company's with 41–71. A claim for a membership goes to
 * the father, not his ehf.
 */
const isPersonal = (digits: string): boolean => {
  const day = Number(digits.slice(0, 2));

  return day >= 1 && day <= 31;
};

export type KennitalaResult =
  | { readonly ok: true; readonly kennitala: string }
  | { readonly ok: false; readonly reason: "format" | "checksum" | "company" };

export const parseKennitala = (input: string): KennitalaResult => {
  const digits = normalizeKennitala(input);

  if (digits === null) {
    return { ok: false, reason: "format" };
  }

  if (!hasValidCheckDigit(digits)) {
    return { ok: false, reason: "checksum" };
  }

  if (!isPersonal(digits)) {
    return { ok: false, reason: "company" };
  }

  return { ok: true, kennitala: digits };
};

/** "0101302989" → "010130-2989", the way it is written on a claim. */
export const formatKennitala = (digits: string): string =>
  `${digits.slice(0, 6)}-${digits.slice(6)}`;
