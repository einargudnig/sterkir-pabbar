import type { users } from "~/db/schema";

type AccessFields = Pick<typeof users.$inferSelect, "isAdmin" | "accessGrantedUntil">;

/**
 * Whether a member may see anything behind the paywall right now.
 *
 *   isAdmin              Aron does not pay for his own product.
 *   accessGrantedUntil   set from /admin when Aron marks a claim paid.
 *
 * The Repeat columns on `users` are dormant and deliberately not read: see
 * "Repeat removed" in docs/solutions/inner-circle.md.
 *
 * Strictly greater-than: at the exact boundary instant, access has ended.
 */
export const hasActiveAccess = (user: AccessFields, now: Date): boolean =>
  user.isAdmin || (user.accessGrantedUntil !== null && user.accessGrantedUntil > now);
