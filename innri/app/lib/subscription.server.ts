import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { redirect } from "react-router";
import { z } from "zod";

import { db } from "~/db";
import { repeatEvents, users } from "~/db/schema";
import { hasActiveAccess, isOpenAccess } from "~/lib/access";
import { requireUser } from "~/lib/auth.server";
import { serverEnv } from "~/lib/env.server";
import { type Mirror, type RepeatSubscription, shouldApply, toMirror } from "~/lib/repeat";
import type { WebhookNudge } from "~/lib/repeat";
import { findActiveSubscriptionIds, getSubscription } from "~/lib/repeat.server";

/**
 * The Repeat mirror on `users`: every write to it, and the guard that reads it.
 *
 * All writes start from a subscription Repeat's API returned to us — a webhook
 * body only ever says which subscription to fetch. See the "Payments switched
 * to Repeat" section of docs/solutions/inner-circle.md.
 */

type UserRow = typeof users.$inferSelect;

type AuthArgs = Parameters<typeof requireUser>[0];

/** Past the paywall: a paying member, or anyone during the testing window. */
export const canEnter = (user: UserRow, now: Date): boolean =>
  isOpenAccess(serverEnv().OPEN_ACCESS_UNTIL, now) || hasActiveAccess(user, now);

/**
 * The paid gate. Called by the member layout, so everything under it is
 * covered, and by the entry redirect so an unpaid member lands on the paywall
 * in one hop.
 */
export const requireActiveAccess = async (args: AuthArgs): Promise<UserRow> => {
  const user = await requireUser(args);

  if (!canEnter(user, new Date())) {
    throw redirect("/subscribe");
  }

  return user;
};

export type SyncResult =
  | { readonly applied: true; readonly userId: string }
  | { readonly applied: false; readonly reason: "unknown-member" | "superseded" };

const writeMirror = async (user: UserRow, mirror: Mirror): Promise<SyncResult> => {
  if (!shouldApply(user, mirror)) {
    return { applied: false, reason: "superseded" };
  }

  await db
    .update(users)
    .set({
      repeatSubscriptionId: mirror.repeatSubscriptionId,
      subscriptionStatus: mirror.subscriptionStatus,
      currentPeriodEnd: mirror.currentPeriodEnd,
    })
    .where(eq(users.id, user.id));

  return { applied: true, userId: user.id };
};

/**
 * Records that this member owns a subscription they have just paid for, before
 * anything else can fail. Status is left for a sync to fill in: the id alone is
 * enough for the paywall's re-sync and the nightly sweep to find it.
 *
 * Bypasses `shouldApply` on purpose — the checkout that created this
 * subscription is the strongest evidence of ownership there is.
 */
export const adoptSubscription = async (userId: string, subscriptionId: string) => {
  await db.update(users).set({ repeatSubscriptionId: subscriptionId }).where(eq(users.id, userId));
};

/** For the paths that already hold both the member and a fresh subscription. */
export const applySubscription = (user: UserRow, subscription: RepeatSubscription) =>
  writeMirror(user, toMirror(subscription, new Date()));

const memberIdSchema = z.uuid();

/**
 * Whose subscription this is, from the FETCHED record only.
 *
 * The row already holding this subscription id wins. Otherwise `external_ref`,
 * which our checkout sets to `users.id` on the order. Whether Repeat copies it
 * from the order onto the subscription is a spike question — the first lookup
 * does not depend on the answer, because checkout writes the id directly.
 */
const findMember = async (subscription: RepeatSubscription): Promise<UserRow | undefined> => {
  const holder = await db.query.users.findFirst({
    where: eq(users.repeatSubscriptionId, subscription.uuid),
  });

  if (holder) {
    return holder;
  }

  const ref = memberIdSchema.safeParse(subscription.external_ref);

  if (!ref.success) {
    return undefined;
  }

  return db.query.users.findFirst({ where: eq(users.id, ref.data) });
};

/** Re-reads one subscription from Repeat and writes what it says now. */
export const syncSubscription = async (uuid: string): Promise<SyncResult> => {
  const subscription = await getSubscription(uuid);
  const member = await findMember(subscription);

  if (!member) {
    return { applied: false, reason: "unknown-member" };
  }

  return applySubscription(member, subscription);
};

/**
 * Asks Repeat directly whether an unpaid-looking member has in fact paid,
 * before the paywall asks them for a card.
 *
 * Two cases need it. The order succeeded but our read after it failed, so the
 * mirror holds an id with no status. Or the order call timed out after the
 * card was charged, so we never learned the id at all — only the email lookup
 * finds that one. Without this, both members would be shown the card form
 * again and could pay twice.
 *
 * Each candidate goes through `applySubscription`, so an inactive subscription
 * other than the member's own cannot overwrite anything.
 */
export const recoverSubscription = async (user: UserRow, email: string) => {
  const found = await findActiveSubscriptionIds(email);

  const candidates = new Set([
    ...(user.repeatSubscriptionId ? [user.repeatSubscriptionId] : []),
    ...found,
  ]);

  for (const id of candidates) {
    await applySubscription(user, await getSubscription(id));
  }
};

/**
 * The reconciliation sweep. Repeat never retries a failed webhook, so this is
 * what bounds a lost `subscription_deactivated` to one day.
 *
 * Canceled subscriptions are swept too: Repeat lets a customer reactivate from
 * its portal, and that reactivation has to reach us even if its webhook did not.
 *
 * Sequential on purpose. There are tens of members, not thousands, and a burst
 * against Repeat's per-key rate limit would fail the sweep it exists to run.
 */
export const syncAllSubscriptions = async () => {
  const rows = await db
    .select({ repeatSubscriptionId: users.repeatSubscriptionId })
    .from(users)
    .where(isNotNull(users.repeatSubscriptionId));

  let applied = 0;
  const failed: string[] = [];

  for (const row of rows) {
    if (row.repeatSubscriptionId === null) {
      continue;
    }

    try {
      const result = await syncSubscription(row.repeatSubscriptionId);

      if (result.applied) {
        applied += 1;
      }
    } catch (error) {
      console.error(`repeat-sync: ${row.repeatSubscriptionId}`, error);
      failed.push(row.repeatSubscriptionId);
    }
  }

  return { checked: rows.length, applied, failed };
};

type Delivery = {
  readonly deliveryId: string;
  readonly nudge: WebhookNudge;
  readonly userId: string | null;
  readonly payload: string;
};

/**
 * Logs a delivery once. A replay from Repeat's dashboard arrives with a fresh
 * delivery id and is logged as its own row, which is correct: it was sent
 * again. What stops it applying twice is that applying is an overwrite.
 */
export const recordDelivery = async (delivery: Delivery) => {
  await db
    .insert(repeatEvents)
    .values({
      repeatDeliveryId: delivery.deliveryId,
      webhookType: delivery.nudge.webhookType,
      userId: delivery.userId,
      repeatSubscriptionId: delivery.nudge.subscriptionIds[0] ?? null,
      amountIsk: delivery.nudge.amountIsk,
      payload: JSON.parse(delivery.payload),
    })
    .onConflictDoNothing({ target: repeatEvents.repeatDeliveryId });
};

/**
 * How long a claim blocks a second checkout. Longer than any one order call
 * (25 s timeout) with room to spare, short enough that a member
 * whose tab died is not locked out for long.
 */
const CLAIM_MS = 2 * 60 * 1000;

/**
 * Takes the member's checkout slot, or reports that one is already running.
 * One conditional UPDATE, so two simultaneous submits cannot both win.
 */
export const claimCheckout = async (userId: string): Promise<boolean> => {
  const now = new Date();
  const stale = new Date(now.getTime() - CLAIM_MS);

  const claimed = await db
    .update(users)
    .set({ checkoutClaimedAt: now })
    .where(
      and(
        eq(users.id, userId),
        or(isNull(users.checkoutClaimedAt), lt(users.checkoutClaimedAt, stale)),
      ),
    )
    .returning({ id: users.id });

  return claimed.length > 0;
};

export const releaseCheckout = async (userId: string) => {
  await db.update(users).set({ checkoutClaimedAt: null }).where(eq(users.id, userId));
};
