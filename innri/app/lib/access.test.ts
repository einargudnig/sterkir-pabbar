import { describe, expect, it } from "vitest";

import { hasActiveAccess, isOpenAccess } from "./access";

const now = new Date("2026-10-15T12:00:00Z");

const later = new Date("2026-11-01T00:00:00Z");

const earlier = new Date("2026-10-01T00:00:00Z");

const member = {
  isAdmin: false,
  accessGrantedUntil: null,
  subscriptionStatus: null,
  currentPeriodEnd: null,
} as const;

describe("hasActiveAccess", () => {
  it("lets in an active subscription whose lease is still running", () => {
    expect(
      hasActiveAccess({ ...member, subscriptionStatus: "active", currentPeriodEnd: later }, now),
    ).toBe(true);
  });

  it("shuts out someone who has never subscribed", () => {
    expect(hasActiveAccess(member, now)).toBe(false);
  });

  it("shuts out an active subscription whose lease has run out", () => {
    expect(
      hasActiveAccess({ ...member, subscriptionStatus: "active", currentPeriodEnd: earlier }, now),
    ).toBe(false);
  });

  /** At the boundary instant itself, access has ended. */
  it("shuts out at the exact moment the period ends", () => {
    expect(
      hasActiveAccess({ ...member, subscriptionStatus: "active", currentPeriodEnd: now }, now),
    ).toBe(false);
  });

  it("lets in one millisecond before the period ends", () => {
    const justAfter = new Date(now.getTime() + 1);

    expect(
      hasActiveAccess(
        { ...member, subscriptionStatus: "active", currentPeriodEnd: justAfter },
        now,
      ),
    ).toBe(true);
  });

  it.each(["paused", "canceled"] as const)(
    "shuts out a %s subscription even with a period end in the future",
    (subscriptionStatus) => {
      expect(hasActiveAccess({ ...member, subscriptionStatus, currentPeriodEnd: later }, now)).toBe(
        false,
      );
    },
  );

  it("shuts out an active status with no period end", () => {
    expect(hasActiveAccess({ ...member, subscriptionStatus: "active" }, now)).toBe(false);
  });

  /** Aron comps someone: the grant must work with no subscription at all. */
  it("lets in a manual grant that has not expired", () => {
    expect(hasActiveAccess({ ...member, accessGrantedUntil: later }, now)).toBe(true);
  });

  it("does not let an expired grant in", () => {
    expect(hasActiveAccess({ ...member, accessGrantedUntil: earlier }, now)).toBe(false);
  });

  /** A canceled mirror written by a sync must not wipe out a live grant. */
  it("keeps a live grant working when the subscription is canceled", () => {
    expect(
      hasActiveAccess(
        {
          ...member,
          accessGrantedUntil: later,
          subscriptionStatus: "canceled",
          currentPeriodEnd: earlier,
        },
        now,
      ),
    ).toBe(true);
  });

  it("always lets an admin in", () => {
    expect(hasActiveAccess({ ...member, isAdmin: true }, now)).toBe(true);
  });
});

describe("isOpenAccess", () => {
  it("opens the paywall before the window closes", () => {
    expect(isOpenAccess(later, now)).toBe(true);
  });

  /** A forgotten setting must close itself, not give the product away. */
  it("closes the paywall once the window has passed", () => {
    expect(isOpenAccess(earlier, now)).toBe(false);
  });

  it("closes at the exact moment the window ends", () => {
    expect(isOpenAccess(now, now)).toBe(false);
  });

  it("stays closed when no window is set", () => {
    expect(isOpenAccess(undefined, now)).toBe(false);
  });
});
