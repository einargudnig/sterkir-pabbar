import type { users } from "~/db/schema";
import { hasActiveAccess } from "~/lib/access";
import { formatDate } from "~/lib/format";

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

type QueueFields = Pick<typeof users.$inferSelect, "readyAt" | "accessGrantedUntil">;

/**
 * Whether Aron has anything to invoice this person for: they said they are
 * ready to start, or they were granted access at some point. Someone who signed
 * up and stopped halfway through the questionnaire shows on the dashboard but
 * not in the queue.
 */
export const inInvoicingQueue = (user: QueueFields): boolean =>
  user.readyAt !== null || user.accessGrantedUntil !== null;

type FunnelFields = QueueFields & { readonly answered: boolean; readonly status: MemberStatus };

export type Funnel = {
  readonly signedUp: number;
  readonly answered: number;
  readonly ready: number;
  readonly withAccess: number;
};

/**
 * The four numbers across the top of /admin, each a subset of the one before
 * it — except `withAccess`, which also counts a member Aron comped before they
 * finished the questionnaire.
 */
export const funnel = (rows: readonly FunnelFields[]): Funnel => ({
  signedUp: rows.length,
  answered: rows.filter((row) => row.answered).length,
  ready: rows.filter((row) => row.readyAt !== null).length,
  withAccess: rows.filter((row) => row.status === "active" || row.status === "expiring").length,
});

/** Past this, a relative "fyrir 23 dögum" is harder to place than the date itself. */
const RELATIVE_DAYS = 14;

/**
 * "Last seen" for the dashboard, from Clerk's `lastActiveAt` — the last day the
 * person had a session, at day granularity, so "Í dag" is as precise as it gets.
 *
 * `now` comes from the loader so server and browser render the same words.
 */
export const lastSeenLabel = (lastActiveAt: Date | null, now: Date): string => {
  if (lastActiveAt === null) {
    return "Aldrei";
  }

  const days = Math.max(0, Math.floor((now.getTime() - lastActiveAt.getTime()) / DAY_MS));

  if (days === 0) {
    return "Í dag";
  }

  if (days === 1) {
    return "Í gær";
  }

  return days < RELATIVE_DAYS ? `Fyrir ${days} dögum` : formatDate(lastActiveAt);
};
