import type { users } from "~/db/schema";

type AccessFields = Pick<
  typeof users.$inferSelect,
  "isAdmin" | "accessGrantedUntil" | "subscriptionStatus" | "currentPeriodEnd"
>;

/**
 * Whether a member may see anything behind the paywall right now.
 *
 * Three ways in, checked independently so none can cancel another:
 *
 *   isAdmin              Aron does not pay for his own product.
 *   accessGrantedUntil   a manual grant from /admin. Kept apart from the Repeat
 *                        mirror so a sync can never wipe a comp he made.
 *   the Repeat mirror    status `active` and the lease still running.
 *
 * `paused` and `canceled` grant nothing: a paused member is not being charged,
 * and a scheduled cancellation stays `active` until Repeat ends it — that is
 * where "keep what you paid for" lives, not here.
 *
 * Strictly greater-than on both dates: at the exact boundary instant, access
 * has ended.
 */
export const hasActiveAccess = (user: AccessFields, now: Date): boolean => {
  if (user.isAdmin) {
    return true;
  }

  if (user.accessGrantedUntil !== null && user.accessGrantedUntil > now) {
    return true;
  }

  return (
    user.subscriptionStatus === "active" &&
    user.currentPeriodEnd !== null &&
    user.currentPeriodEnd > now
  );
};
