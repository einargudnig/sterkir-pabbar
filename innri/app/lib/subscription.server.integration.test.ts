import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createMember, reload, resetDatabase } from "../../test/db";
import { installFakeRepeat } from "../../test/fake-repeat";
import { db } from "~/db";
import { users } from "~/db/schema";
import { hasActiveAccess } from "~/lib/access";
import { serverEnv } from "~/lib/env.server";

import {
  adoptSubscription,
  claimCheckout,
  recoverSubscription,
  releaseCheckout,
  syncAllSubscriptions,
  syncSubscription,
} from "./subscription.server";

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * DAY_MS).toISOString().slice(0, 10);

let repeat: ReturnType<typeof installFakeRepeat>;

beforeEach(async () => {
  await resetDatabase();

  repeat = installFakeRepeat();
});

describe("claimCheckout", () => {
  it("lets exactly one of two simultaneous submits charge the card", async () => {
    const member = await createMember();

    const results = await Promise.all([claimCheckout(member.id), claimCheckout(member.id)]);

    expect([...results].sort()).toEqual([false, true]);
  });

  it("blocks a second checkout while the first is still running", async () => {
    const member = await createMember();

    expect(await claimCheckout(member.id)).toBe(true);
    expect(await claimCheckout(member.id)).toBe(false);
  });

  it("frees the slot once the checkout is released", async () => {
    const member = await createMember();

    await claimCheckout(member.id);
    await releaseCheckout(member.id);

    expect(await claimCheckout(member.id)).toBe(true);
  });

  it("takes over a claim abandoned longer ago than any order call can run", async () => {
    const member = await createMember({ checkoutClaimedAt: new Date(Date.now() - 3 * 60 * 1000) });

    expect(await claimCheckout(member.id)).toBe(true);
  });

  it("respects a claim that is recent enough to still be charging", async () => {
    const member = await createMember({ checkoutClaimedAt: new Date(Date.now() - 60 * 1000) });

    expect(await claimCheckout(member.id)).toBe(false);
  });

  it("does not let one member's claim block another's", async () => {
    const first = await createMember();
    const second = await createMember();

    await claimCheckout(first.id);

    expect(await claimCheckout(second.id)).toBe(true);
  });
});

describe("syncSubscription", () => {
  it("finds the member by the subscription id checkout adopted, without external_ref", async () => {
    const member = await createMember();

    await adoptSubscription(member.id, "sub-1");

    repeat.setSubscription({ uuid: "sub-1", active: true, upcoming_charge_dates: [isoDate(30)] });

    const result = await syncSubscription("sub-1");

    expect(result).toEqual({ applied: true, userId: member.id });
    expect(hasActiveAccess(await reload(member.id), new Date())).toBe(true);
  });

  it("prefers the member holding the subscription over the one external_ref names", async () => {
    const holder = await createMember({ repeatSubscriptionId: "sub-1" });
    const named = await createMember();

    repeat.setSubscription({
      uuid: "sub-1",
      active: true,
      external_ref: named.id,
      upcoming_charge_dates: [isoDate(30)],
    });

    await syncSubscription("sub-1");

    expect((await reload(holder.id)).subscriptionStatus).toBe("active");
    expect((await reload(named.id)).repeatSubscriptionId).toBeNull();
  });

  it("reports a subscription nobody owns rather than writing it anywhere", async () => {
    repeat.setSubscription({ uuid: "sub-x", active: true, upcoming_charge_dates: [isoDate(30)] });

    expect(await syncSubscription("sub-x")).toEqual({ applied: false, reason: "unknown-member" });
  });

  it("never wipes a manual grant when the subscription is canceled", async () => {
    const grantedUntil = new Date(Date.now() + 60 * DAY_MS);

    const member = await createMember({
      repeatSubscriptionId: "sub-1",
      subscriptionStatus: "active",
      accessGrantedUntil: grantedUntil,
    });

    repeat.setSubscription({ uuid: "sub-1", active: false });

    await syncSubscription("sub-1");

    const after = await reload(member.id);

    expect(after.subscriptionStatus).toBe("canceled");
    expect(after.accessGrantedUntil).toEqual(grantedUntil);
    expect(hasActiveAccess(after, new Date())).toBe(true);
  });
});

describe("syncAllSubscriptions", () => {
  it("catches a cancellation whose webhook never arrived", async () => {
    const member = await createMember({
      repeatSubscriptionId: "sub-1",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(Date.now() + 20 * DAY_MS),
    });

    repeat.setSubscription({ uuid: "sub-1", active: false });

    const result = await syncAllSubscriptions();

    expect(result).toEqual({ checked: 1, applied: 1, failed: [] });
    expect(hasActiveAccess(await reload(member.id), new Date())).toBe(false);
  });

  it("catches a reactivation from Repeat's portal on a canceled member", async () => {
    const member = await createMember({
      repeatSubscriptionId: "sub-1",
      subscriptionStatus: "canceled",
    });

    repeat.setSubscription({ uuid: "sub-1", active: true, upcoming_charge_dates: [isoDate(30)] });

    await syncAllSubscriptions();

    expect(hasActiveAccess(await reload(member.id), new Date())).toBe(true);
  });

  it("keeps going past a subscription Repeat fails on, and names it", async () => {
    const broken = await createMember({
      repeatSubscriptionId: "sub-broken",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(Date.now() + 5 * DAY_MS),
    });

    const healthy = await createMember({ repeatSubscriptionId: "sub-ok" });

    repeat.failLookup("sub-broken");
    repeat.setSubscription({ uuid: "sub-ok", active: true, upcoming_charge_dates: [isoDate(30)] });

    const result = await syncAllSubscriptions();

    expect(result).toEqual({ checked: 2, applied: 1, failed: ["sub-broken"] });
    expect((await reload(healthy.id)).subscriptionStatus).toBe("active");
    expect((await reload(broken.id)).currentPeriodEnd).toEqual(broken.currentPeriodEnd);
  });

  it("skips members who never subscribed", async () => {
    await createMember();

    expect(await syncAllSubscriptions()).toEqual({ checked: 0, applied: 0, failed: [] });
    expect(repeat.requests).toEqual([]);
  });
});

describe("recoverSubscription", () => {
  const email = "pabbi@example.is";

  it("finds a charge whose order call timed out, by email, before asking for a card again", async () => {
    const member = await createMember({ email });

    repeat.setActiveForEmail(email, [
      { uuid: "sub-paid", productUuid: serverEnv().REPEAT_PRODUCT_UUID },
    ]);

    repeat.setSubscription({
      uuid: "sub-paid",
      active: true,
      upcoming_charge_dates: [isoDate(30)],
    });

    await recoverSubscription(member, email);

    const after = await reload(member.id);

    expect(after.repeatSubscriptionId).toBe("sub-paid");
    expect(hasActiveAccess(after, new Date())).toBe(true);
  });

  it("does not let a subscription to another of Aron's products in", async () => {
    const member = await createMember({ email });

    repeat.setActiveForEmail(email, [
      { uuid: "sub-other", productUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ]);

    repeat.setSubscription({
      uuid: "sub-other",
      active: true,
      upcoming_charge_dates: [isoDate(30)],
    });

    await recoverSubscription(member, email);

    const after = await reload(member.id);

    expect(after.repeatSubscriptionId).toBeNull();
    expect(hasActiveAccess(after, new Date())).toBe(false);
  });

  it("fills in the status of a subscription checkout adopted but could not read", async () => {
    const member = await createMember({ email });

    await adoptSubscription(member.id, "sub-1");

    repeat.setSubscription({ uuid: "sub-1", active: true, upcoming_charge_dates: [isoDate(30)] });

    await recoverSubscription(await reload(member.id), email);

    expect((await reload(member.id)).subscriptionStatus).toBe("active");
  });

  it("changes nothing for a member who really has not paid", async () => {
    const member = await createMember({ email });

    await recoverSubscription(member, email);

    const [after] = await db.select().from(users).where(eq(users.id, member.id));

    expect(after).toEqual(member);
  });
});
