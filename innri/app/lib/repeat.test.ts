import type { z } from "zod";
import { describe, expect, it } from "vitest";

import { hasActiveAccess } from "./access";
import {
  GRACE_DAYS,
  repeatSubscriptionSchema,
  shouldApply,
  toMirror,
  toNudge,
  webhookBodySchema,
} from "./repeat";

const now = new Date("2026-10-15T12:00:00Z");

const DAY_MS = 24 * 60 * 60 * 1000;

type SubscriptionFields = Partial<z.input<typeof repeatSubscriptionSchema>>;

const subscription = (fields: SubscriptionFields) =>
  repeatSubscriptionSchema.parse({ uuid: "sub-1", ...fields });

const accessFor = (fields: SubscriptionFields) => {
  const mirror = toMirror(subscription(fields), now);

  return hasActiveAccess(
    {
      isAdmin: false,
      accessGrantedUntil: null,
      subscriptionStatus: mirror.subscriptionStatus,
      currentPeriodEnd: mirror.currentPeriodEnd,
    },
    now,
  );
};

describe("repeatSubscriptionSchema", () => {
  /** A missing field must fail closed: no `active` means no access. */
  it("treats a subscription that does not say it is active as inactive", () => {
    expect(subscription({}).active).toBe(false);
    expect(accessFor({ upcoming_charge_dates: ["2026-11-01"] })).toBe(false);
  });
});

describe("toMirror", () => {
  it("leases access until the next charge plus the grace window", () => {
    const mirror = toMirror(
      subscription({ active: true, upcoming_charge_dates: ["2026-11-01", "2026-12-01"] }),
      now,
    );

    expect(mirror.subscriptionStatus).toBe("active");
    expect(mirror.currentPeriodEnd).toEqual(
      new Date(new Date("2026-11-01T00:00:00Z").getTime() + GRACE_DAYS * DAY_MS),
    );
  });

  it("ends access at the scheduled cancellation date, not the next charge", () => {
    const mirror = toMirror(
      subscription({
        active: true,
        resign_date: "2026-10-31T00:00:00Z",
        upcoming_charge_dates: ["2026-11-01"],
      }),
      now,
    );

    expect(mirror.subscriptionStatus).toBe("active");
    expect(mirror.currentPeriodEnd).toEqual(new Date("2026-10-31T00:00:00Z"));
  });

  it("marks an inactive subscription canceled, with access ending now", () => {
    const mirror = toMirror(subscription({ active: false }), now);

    expect(mirror).toEqual({
      repeatSubscriptionId: "sub-1",
      subscriptionStatus: "canceled",
      currentPeriodEnd: now,
    });
  });

  it("gives a paused subscription no access", () => {
    expect(toMirror(subscription({ active: true, is_paused: true }), now).subscriptionStatus).toBe(
      "paused",
    );
    expect(accessFor({ active: true, is_paused: true })).toBe(false);
  });

  /**
   * Should not happen, but if Repeat reports active with nothing scheduled,
   * the lease starts now and the next sync decides.
   */
  it("leases one grace period from now when no charge is scheduled", () => {
    const mirror = toMirror(subscription({ active: true }), now);

    expect(mirror.currentPeriodEnd).toEqual(new Date(now.getTime() + GRACE_DAYS * DAY_MS));
  });
});

describe("shouldApply", () => {
  const active = toMirror(
    subscription({ active: true, upcoming_charge_dates: ["2026-11-01"] }),
    now,
  );

  const canceled = toMirror(subscription({ active: false }), now);

  it("writes to a member with no subscription yet", () => {
    expect(shouldApply({ repeatSubscriptionId: null }, canceled)).toBe(true);
  });

  it("always writes an update to the member's own subscription", () => {
    expect(shouldApply({ repeatSubscriptionId: "sub-1" }, canceled)).toBe(true);
  });

  /**
   * The re-subscriber: their old subscription's late deactivation must not
   * cut off the new one.
   */
  it("ignores an inactive subscription that is not the member's current one", () => {
    expect(shouldApply({ repeatSubscriptionId: "sub-2" }, canceled)).toBe(false);
  });

  it("lets a new active subscription replace an old one", () => {
    expect(shouldApply({ repeatSubscriptionId: "sub-0" }, active)).toBe(true);
  });
});

describe("toNudge", () => {
  /**
   * Bodies go in as JSON text, the way the route receives them — which is also
   * what lets a test send fields the schema does not declare.
   */
  const parse = (json: string) => toNudge(webhookBodySchema.parse(JSON.parse(json)));

  it.each(["subscription_created", "subscription_deactivated", "next_date_changed"])(
    "reads the top-level uuid as the subscription on %s",
    (webhookType) => {
      expect(
        parse(JSON.stringify({ webhook_type: webhookType, uuid: "sub-1" })).subscriptionIds,
      ).toEqual(["sub-1"]);
    },
  );

  it("reads the nested subscription on a cancellation, not the request's own id", () => {
    const nudge = parse(
      JSON.stringify({
        webhook_type: "cancellation_requested",
        uuid: "request-9",
        subscription: { uuid: "sub-1" },
      }),
    );

    expect(nudge.subscriptionIds).toEqual(["sub-1"]);
  });

  it("collects and de-duplicates every subscription on a payment attempt", () => {
    const nudge = parse(
      JSON.stringify({
        webhook_type: "payment_attempt",
        subscription: { uuid: "sub-1" },
        subscriptions: [{ uuid: "sub-1" }, { uuid: "sub-2" }],
      }),
    );

    expect(nudge.subscriptionIds).toEqual(["sub-1", "sub-2"]);
  });

  it("never reads an order uuid as a subscription", () => {
    expect(
      parse(JSON.stringify({ webhook_type: "order_created", uuid: "order-1" })).subscriptionIds,
    ).toEqual([]);
  });

  /**
   * The trust boundary. A body can claim anything — the nudge carries only
   * WHICH subscription to fetch, so a forged `active: true` has nowhere to go.
   * What decides access is the fetched record.
   */
  it("carries no access decision from the body", () => {
    const nudge = parse(
      JSON.stringify({
        webhook_type: "subscription_created",
        uuid: "sub-1",
        active: true,
        upcoming_charge_dates: ["2099-01-01"],
      }),
    );

    expect(nudge).toEqual({
      webhookType: "subscription_created",
      subscriptionIds: ["sub-1"],
      amountIsk: null,
    });
    expect(accessFor({ active: false })).toBe(false);
  });

  /**
   * A dashboard replay re-sends the same body under a fresh delivery id. It
   * must lead to exactly the same re-fetch, and applying the same fetched
   * state twice gives the same mirror — that is the idempotency.
   */
  it("gives a replay the same nudge, and the same mirror when applied again", () => {
    const body = {
      webhook_type: "subscription_transaction_created",
      subscription: { uuid: "sub-1" },
      amount: 4990,
    };

    expect(parse(JSON.stringify(body))).toEqual(parse(JSON.stringify(body)));

    const fetched = subscription({ active: true, upcoming_charge_dates: ["2026-11-01"] });

    expect(toMirror(fetched, now)).toEqual(toMirror(fetched, now));
  });

  it("keeps the amount on a transaction and drops it elsewhere", () => {
    expect(
      parse(
        JSON.stringify({
          webhook_type: "subscription_transaction_created",
          subscription: { uuid: "sub-1" },
          amount: 4990,
        }),
      ).amountIsk,
    ).toBe(4990);
    expect(
      parse(JSON.stringify({ webhook_type: "payment_attempt", amount: 499000 })).amountIsk,
    ).toBeNull();
  });

  /** A field we only log must never cost us the nudge. */
  it("keeps the nudge when the amount arrives in an unexpected format", () => {
    const nudge = parse(
      JSON.stringify({
        webhook_type: "subscription_transaction_created",
        subscription: { uuid: "sub-1" },
        amount: "4990.00",
      }),
    );

    expect(nudge.subscriptionIds).toEqual(["sub-1"]);
    expect(nudge.amountIsk).toBeNull();
  });

  it("rejects a body that is not a Repeat webhook", () => {
    expect(webhookBodySchema.safeParse(JSON.parse('{"hello":"world"}')).success).toBe(false);
  });
});
