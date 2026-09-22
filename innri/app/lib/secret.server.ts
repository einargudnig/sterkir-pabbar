import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compares a presented secret with the expected one in constant time.
 *
 * Both sides are hashed first so the comparison is always between two 32-byte
 * digests: `timingSafeEqual` throws on unequal lengths, and returning early on
 * a length mismatch would itself leak the secret's length.
 *
 * Used where a shared secret is the only authentication there is — Repeat's
 * unsigned webhooks and Vercel's cron bearer token.
 */
export const secretMatches = (presented: string | null, expected: string): boolean => {
  if (presented === null || presented.length === 0 || expected.length === 0) {
    return false;
  }

  const digest = (value: string) => createHash("sha256").update(value).digest();

  return timingSafeEqual(digest(presented), digest(expected));
};

/** Header name configured on every event in Repeat's "API og vefkrókar" page. */
export const REPEAT_SECRET_HEADER = "x-webhook-secret";

/** Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. */
export const bearerToken = (authorization: string | null): string | null => {
  const match = authorization?.match(/^Bearer (.+)$/);

  return match?.[1] ?? null;
};
