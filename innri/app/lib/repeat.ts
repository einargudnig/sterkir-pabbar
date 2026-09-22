import { z } from "zod";

/**
 * Repeat's data, and what it means for access. No network and no database, so
 * every rule that decides who gets in is testable on its own — the calls live
 * in `repeat.server.ts`, the writes in `subscription.server.ts`.
 *
 * Only the fields a decision reads are declared. Zod strips the rest, so a new
 * field Repeat adds cannot change behaviour by accident.
 */

/** `GET /subscriptions/{uuid}/` — the only source the mirror is written from. */
export const repeatSubscriptionSchema = z.object({
  uuid: z.string().min(1),
  /**
   * Optional in Repeat's OpenAPI. A subscription that does not say it is
   * active is treated as inactive: the failure mode of a missing field has to
   * be "no access", never "free access".
   */
  active: z.boolean().default(false),
  is_paused: z.boolean().default(false),
  external_ref: z.string().nullish(),
  /** Empty when inactive or paused. ISO dates, `YYYY-MM-DD`. */
  upcoming_charge_dates: z.array(z.iso.date()).default([]),
  /** Set when a cancellation is scheduled: the subscription ends then. */
  resign_date: z.iso.datetime({ offset: true, local: true }).nullish(),
  /** A cancellation queued behind a commitment period. Access continues. */
  wants_to_cancel: z.boolean().default(false),
});

export type RepeatSubscription = z.infer<typeof repeatSubscriptionSchema>;

/**
 * `GET /subscriptions/?email=…&active=true`, one page. The product is on each
 * row because Aron's shop may sell more than the members' area, and a member
 * who also buys something else from him must not be let in by it.
 */
export const subscriptionListSchema = z.object({
  results: z.array(
    z.object({
      uuid: z.string().min(1),
      product: z.object({ uuid: z.string().min(1) }),
    }),
  ),
});

/** `POST /orders/`. */
export const orderCreatedSchema = z.object({
  uuid: z.string().min(1),
  customer_uuid: z.string().min(1),
  subscriptions_created: z.array(z.string().min(1)),
});

/** `GET /subscriptions/{uuid}/cancel/` — the dry run shown before confirming. */
export const cancellationPreviewSchema = z.object({
  outcome: z.enum(["IMMEDIATE", "SCHEDULED", "AFTER_COMMITMENT_COUNT"]),
  effective_date: z.iso.datetime({ offset: true, local: true }).nullable(),
});

export type CancellationPreview = z.infer<typeof cancellationPreviewSchema>;

/** `POST /subscriptions/{uuid}/cancel/`. */
export const cancellationResultSchema = z.object({
  subscription: repeatSubscriptionSchema,
});

/** `GET /products/{uuid}/` — only what the paywall shows. */
export const repeatProductSchema = z.object({
  title: z.string(),
  price: z.number().int().nullable(),
});

/**
 * Days of access beyond the next charge date. It covers the retry window —
 * Aron's failure rule cancels after 7 failed daily attempts — plus one day for
 * the nightly sync to notice. See docs/solutions/payments-iceland.md.
 *
 * This is a lease, not a promise. A healthy sync pushes it forward every
 * month; if the sync stops, access runs out on its own rather than lasting
 * forever. Webhooks are unsigned and never retried, so "we stopped hearing
 * from Repeat" must fail closed.
 */
export const GRACE_DAYS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MirrorStatus = "active" | "paused" | "canceled";

export type Mirror = {
  readonly repeatSubscriptionId: string;
  readonly subscriptionStatus: MirrorStatus;
  readonly currentPeriodEnd: Date;
};

/**
 * Turns what Repeat says now into the row `requireActiveAccess` reads.
 *
 * An active subscription with no upcoming charge and no scheduled end should
 * not exist, but if it does, access lasts one grace period from now — the next
 * sync either renews it or it lapses.
 */
export const toMirror = (subscription: RepeatSubscription, now: Date): Mirror => {
  const repeatSubscriptionId = subscription.uuid;

  if (!subscription.active) {
    return { repeatSubscriptionId, subscriptionStatus: "canceled", currentPeriodEnd: now };
  }

  if (subscription.is_paused) {
    return { repeatSubscriptionId, subscriptionStatus: "paused", currentPeriodEnd: now };
  }

  if (subscription.resign_date) {
    return {
      repeatSubscriptionId,
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(subscription.resign_date),
    };
  }

  const nextCharge = subscription.upcoming_charge_dates[0];
  const base = nextCharge ? new Date(`${nextCharge}T00:00:00Z`) : now;

  return {
    repeatSubscriptionId,
    subscriptionStatus: "active",
    currentPeriodEnd: new Date(base.getTime() + GRACE_DAYS * DAY_MS),
  };
};

type CurrentMirror = {
  readonly repeatSubscriptionId: string | null;
};

/**
 * Whether a fetched subscription may overwrite a member's mirror.
 *
 * A member who cancels and later re-subscribes has two subscriptions in Repeat.
 * A late or replayed `subscription_deactivated` for the OLD one must not cut
 * off the new one. So a different subscription only takes over when it is the
 * one granting access now.
 */
export const shouldApply = (current: CurrentMirror, incoming: Mirror): boolean => {
  if (current.repeatSubscriptionId === null) {
    return true;
  }

  if (current.repeatSubscriptionId === incoming.repeatSubscriptionId) {
    return true;
  }

  return incoming.subscriptionStatus === "active";
};

/**
 * Events whose top-level `uuid` is the subscription itself. On every other
 * event the top-level `uuid` is an order, a transaction or nothing at all, and
 * the subscription sits under `subscription` / `subscriptions`.
 */
const SUBSCRIPTION_BODY_EVENTS: ReadonlySet<string> = new Set([
  "subscription_created",
  "subscription_deactivated",
  "next_date_changed",
]);

const subscriptionRefSchema = z.object({ uuid: z.string().min(1) });

export const webhookBodySchema = z.object({
  webhook_type: z.string().min(1),
  uuid: z.string().min(1).optional(),
  subscription: subscriptionRefSchema.nullish(),
  subscriptions: z.array(subscriptionRefSchema).optional(),
  /**
   * On `subscription_transaction_created`: the cycle's charge, whole krónur.
   * Logged, never decided on — so a surprise in its format degrades to null
   * rather than failing the body and losing the nudge.
   */
  amount: z.number().int().nullish().catch(null),
});

export type WebhookBody = z.infer<typeof webhookBodySchema>;

export type WebhookNudge = {
  readonly webhookType: string;
  readonly subscriptionIds: readonly string[];
  readonly amountIsk: number | null;
};

/**
 * Reads a delivery for the one thing it is trusted for: WHICH subscriptions to
 * go and look at. Nothing else in the body is used to decide access — the
 * handler re-fetches each of these from Repeat and writes that instead.
 */
export const toNudge = (body: WebhookBody): WebhookNudge => {
  const { webhook_type: webhookType, uuid, subscription, subscriptions, amount } = body;

  const ids = SUBSCRIPTION_BODY_EVENTS.has(webhookType)
    ? [uuid]
    : [subscription?.uuid, ...(subscriptions ?? []).map((entry) => entry.uuid)];

  const subscriptionIds = [...new Set(ids.filter((id): id is string => id !== undefined))];

  const amountIsk = webhookType === "subscription_transaction_created" ? (amount ?? null) : null;

  return { webhookType, subscriptionIds, amountIsk };
};
