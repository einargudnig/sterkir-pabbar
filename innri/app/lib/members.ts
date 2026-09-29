import type { users } from "~/db/schema";
import { hasActiveAccess } from "~/lib/access";

/**
 * Where each member stands in Aron's manual invoicing, for /admin.
 *
 * Plain module with no database import, so the rules are testable on their own
 * and the admin page's grouping cannot disagree with the paywall — both go
 * through `hasActiveAccess`.
 */

type StatusFields = Pick<
  typeof users.$inferSelect,
  "isAdmin" | "accessGrantedUntil" | "subscriptionStatus" | "currentPeriodEnd"
>;

export const MEMBER_STATUSES = ["pending", "expiring", "active", "lapsed"] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** How far ahead "runs out soon" looks — long enough to send a claim and have it paid. */
export const EXPIRING_WITHIN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * pending    never granted — waiting for their first claim
 * expiring   in, and the grant ends within EXPIRING_WITHIN_DAYS — time for the next claim
 * active     in, with longer to go (or paying through Repeat)
 * lapsed     had a grant, it ran out
 */
export const memberStatus = (user: StatusFields, now: Date): MemberStatus => {
  if (hasActiveAccess(user, now)) {
    const grant = user.accessGrantedUntil;

    return grant !== null && grant.getTime() - now.getTime() <= EXPIRING_WITHIN_DAYS * DAY_MS
      ? "expiring"
      : "active";
  }

  return user.accessGrantedUntil === null ? "pending" : "lapsed";
};

/**
 * The new end of a member's access after Aron marks a claim paid.
 *
 * Extends from whichever is later, now or the current end: paying early must
 * not cost a member the days they had left, and paying late must not backdate
 * a month they could not use.
 */
export const extendGrant = (current: Date | null, now: Date, days: number): Date => {
  const from = current !== null && current > now ? current : now;

  return new Date(from.getTime() + days * DAY_MS);
};
