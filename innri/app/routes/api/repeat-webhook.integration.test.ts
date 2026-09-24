import { count, eq } from "drizzle-orm";
import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { createMember, reload, resetDatabase } from "../../../test/db";
import { installFakeRepeat } from "../../../test/fake-repeat";
import { db } from "~/db";
import { repeatEvents, users } from "~/db/schema";
import { hasActiveAccess } from "~/lib/access";
import { GRACE_DAYS } from "~/lib/repeat";
import { serverEnv } from "~/lib/env.server";

import { action } from "./repeat-webhook";

/**
 * Risk items 2 and 3 in docs/solutions/inner-circle.md: Repeat's unsigned
 * webhook, end to end through the real handler and a real database.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * DAY_MS).toISOString().slice(0, 10);

const leaseFrom = (date: string) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + GRACE_DAYS * DAY_MS);

const withSecret = (deliveryId: string): HeadersInit => ({
  "x-webhook-secret": serverEnv().REPEAT_WEBHOOK_SECRET,
  "x-repeat-delivery-id": deliveryId,
});

const WEBHOOK_URL = "https://app.test/api/repeat/webhook";

const deliver = (body: string, headers: HeadersInit) =>
  action({
    request: new Request(WEBHOOK_URL, { method: "POST", headers, body }),
    url: new URL(WEBHOOK_URL),
    pattern: "/api/repeat/webhook",
    params: {},
    context: new RouterContextProvider(),
  });

const mirrorOf = async (id: string) => {
  const row = await reload(id);

  return {
    repeatSubscriptionId: row.repeatSubscriptionId,
    subscriptionStatus: row.subscriptionStatus,
    currentPeriodEnd: row.currentPeriodEnd,
  };
};

const loggedDeliveries = async () => {
  const [row] = await db.select({ total: count() }).from(repeatEvents);

  return row?.total ?? 0;
};

const now = () => new Date();

let repeat: ReturnType<typeof installFakeRepeat>;

beforeEach(async () => {
  await resetDatabase();

  repeat = installFakeRepeat();
});

describe("who may deliver", () => {
  const created = JSON.stringify({ webhook_type: "subscription_created", uuid: "sub-1" });

  it("rejects a delivery with no secret header, and does nothing else", async () => {
    const member = await createMember({ repeatSubscriptionId: "sub-1" });

    const response = await deliver(created, { "x-repeat-delivery-id": "d-1" });

    expect(response.status).toBe(401);
    expect(repeat.requests).toEqual([]);
    expect(await loggedDeliveries()).toBe(0);
    expect(await mirrorOf(member.id)).toEqual({
      repeatSubscriptionId: "sub-1",
      subscriptionStatus: null,
      currentPeriodEnd: null,
    });
  });

  it("rejects a wrong secret the same way", async () => {
    const response = await deliver(created, {
      "x-webhook-secret": `${serverEnv().REPEAT_WEBHOOK_SECRET}x`,
      "x-repeat-delivery-id": "d-1",
    });

    expect(response.status).toBe(401);
    expect(repeat.requests).toEqual([]);
    expect(await loggedDeliveries()).toBe(0);
  });

  it("rejects a body that is not JSON before touching Repeat or the log", async () => {
    const response = await deliver("{not json", withSecret("d-1"));

    expect(response.status).toBe(400);
    expect(repeat.requests).toEqual([]);
    expect(await loggedDeliveries()).toBe(0);
  });

  it("rejects JSON that is not a Repeat webhook", async () => {
    const response = await deliver(JSON.stringify({ hello: "world" }), withSecret("d-1"));

    expect(response.status).toBe(400);
    expect(await loggedDeliveries()).toBe(0);
  });
});

describe("what a delivery is trusted for", () => {
  it("revokes access when the body says active but Repeat says the subscription has ended", async () => {
    const member = await createMember({
      repeatSubscriptionId: "sub-1",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(Date.now() + 20 * DAY_MS),
    });

    repeat.setSubscription({ uuid: "sub-1", active: false, external_ref: member.id });

    const forged = JSON.stringify({
      webhook_type: "subscription_created",
      uuid: "sub-1",
      active: true,
      upcoming_charge_dates: [isoDate(365)],
    });

    const response = await deliver(forged, withSecret("d-1"));
    const after = await reload(member.id);

    expect(response.status).toBe(200);
    expect(after.subscriptionStatus).toBe("canceled");
    expect(hasActiveAccess(after, now())).toBe(false);
  });

  it("grants nothing to a member who never paid, however the body is phrased", async () => {
    const member = await createMember();

    repeat.setSubscription({ uuid: "sub-1", active: false, external_ref: member.id });

    await deliver(
      JSON.stringify({ webhook_type: "subscription_created", uuid: "sub-1", active: true }),
      withSecret("d-1"),
    );

    expect(hasActiveAccess(await reload(member.id), now())).toBe(false);
  });

  it("takes the lease from Repeat's charge date, not from dates in the body", async () => {
    const member = await createMember();
    const nextCharge = isoDate(30);

    repeat.setSubscription({
      uuid: "sub-1",
      active: true,
      external_ref: member.id,
      upcoming_charge_dates: [nextCharge],
    });

    await deliver(
      JSON.stringify({
        webhook_type: "subscription_created",
        uuid: "sub-1",
        upcoming_charge_dates: [isoDate(3650)],
      }),
      withSecret("d-1"),
    );

    const after = await reload(member.id);

    expect(repeat.requests).toEqual(["GET /subscriptions/sub-1/"]);
    expect(after.subscriptionStatus).toBe("active");
    expect(after.currentPeriodEnd).toEqual(leaseFrom(nextCharge));
    expect(hasActiveAccess(after, now())).toBe(true);
  });

  it("finds a new member through external_ref and logs the delivery against them", async () => {
    const member = await createMember();

    repeat.setSubscription({
      uuid: "sub-1",
      active: true,
      external_ref: member.id,
      upcoming_charge_dates: [isoDate(30)],
    });

    await deliver(
      JSON.stringify({
        webhook_type: "subscription_transaction_created",
        subscription: { uuid: "sub-1" },
        amount: 4990,
      }),
      withSecret("d-1"),
    );

    const [event] = await db.select().from(repeatEvents);

    expect((await reload(member.id)).repeatSubscriptionId).toBe("sub-1");
    expect(event).toMatchObject({
      repeatDeliveryId: "d-1",
      webhookType: "subscription_transaction_created",
      userId: member.id,
      repeatSubscriptionId: "sub-1",
      amountIsk: 4990,
    });
  });

  it("writes nothing for a subscription no member owns, and still logs it", async () => {
    const bystander = await createMember();
    const before = await mirrorOf(bystander.id);

    repeat.setSubscription({ uuid: "sub-x", active: true, upcoming_charge_dates: [isoDate(30)] });

    const response = await deliver(
      JSON.stringify({ webhook_type: "subscription_created", uuid: "sub-x" }),
      withSecret("d-1"),
    );

    const [event] = await db.select().from(repeatEvents);

    expect(response.status).toBe(200);
    expect(await mirrorOf(bystander.id)).toEqual(before);
    expect(event?.userId).toBeNull();
  });

  it("cannot be steered to a member by an external_ref that is not a member id", async () => {
    const member = await createMember();

    repeat.setSubscription({
      uuid: "sub-x",
      active: true,
      external_ref: `${member.id}' or 1=1 --`,
      upcoming_charge_dates: [isoDate(30)],
    });

    await deliver(
      JSON.stringify({ webhook_type: "subscription_created", uuid: "sub-x" }),
      withSecret("d-1"),
    );

    expect((await reload(member.id)).repeatSubscriptionId).toBeNull();
  });
});

describe("idempotency", () => {
  const renewal = JSON.stringify({
    webhook_type: "subscription_transaction_created",
    subscription: { uuid: "sub-1" },
    amount: 4990,
  });

  const activeMember = async () => {
    const member = await createMember({ repeatSubscriptionId: "sub-1" });

    repeat.setSubscription({
      uuid: "sub-1",
      active: true,
      external_ref: member.id,
      upcoming_charge_dates: [isoDate(30)],
    });

    return member;
  };

  it("leaves the mirror as one delivery would when the same delivery arrives twice", async () => {
    const member = await activeMember();

    await deliver(renewal, withSecret("d-1"));
    const once = await mirrorOf(member.id);

    const second = await deliver(renewal, withSecret("d-1"));

    expect(second.status).toBe(200);
    expect(await mirrorOf(member.id)).toEqual(once);
    expect(await loggedDeliveries()).toBe(1);
  });

  it("leaves the mirror as one delivery would on a dashboard replay with a fresh id", async () => {
    const member = await activeMember();

    await deliver(renewal, withSecret("d-1"));
    const once = await mirrorOf(member.id);

    await deliver(renewal, withSecret("d-1-replay"));

    expect(await mirrorOf(member.id)).toEqual(once);
    expect(await loggedDeliveries()).toBe(2);
  });

  it("does not let a late cancellation of an old subscription cut off the new one", async () => {
    const renewedUntil = isoDate(30);

    const member = await createMember({
      repeatSubscriptionId: "sub-new",
      subscriptionStatus: "active",
      currentPeriodEnd: leaseFrom(renewedUntil),
    });

    repeat.setSubscription({ uuid: "sub-old", active: false, external_ref: member.id });

    await deliver(
      JSON.stringify({ webhook_type: "subscription_deactivated", uuid: "sub-old" }),
      withSecret("d-late"),
    );

    const after = await reload(member.id);

    expect(after.repeatSubscriptionId).toBe("sub-new");
    expect(after.subscriptionStatus).toBe("active");
    expect(hasActiveAccess(after, now())).toBe(true);
  });
});

describe("when Repeat cannot be reached", () => {
  it("answers 502 so the delivery can be replayed, logs it, and leaves the mirror alone", async () => {
    const member = await createMember({
      repeatSubscriptionId: "sub-1",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(Date.now() + 5 * DAY_MS),
    });

    const before = await mirrorOf(member.id);

    repeat.failLookup("sub-1");

    const response = await deliver(
      JSON.stringify({ webhook_type: "subscription_deactivated", uuid: "sub-1" }),
      withSecret("d-1"),
    );

    const [event] = await db
      .select()
      .from(repeatEvents)
      .where(eq(repeatEvents.repeatDeliveryId, "d-1"));

    expect(response.status).toBe(502);
    expect(await mirrorOf(member.id)).toEqual(before);
    expect(event?.userId).toBeNull();
  });

  it("logs a dashboard test-fire that carries no delivery id", async () => {
    const response = await deliver(JSON.stringify({ webhook_type: "ping" }), {
      "x-webhook-secret": serverEnv().REPEAT_WEBHOOK_SECRET,
    });

    const rows = await db.select().from(repeatEvents);

    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.repeatDeliveryId).toMatch(/^unlabelled-/);
    expect(await db.select().from(users)).toEqual([]);
  });
});
