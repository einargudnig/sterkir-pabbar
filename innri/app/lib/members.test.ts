import { describe, expect, it } from "vitest";

import { extendGrant, memberStatus } from "./members";

const now = new Date("2026-10-15T12:00:00Z");

const days = (count: number) => new Date(now.getTime() + count * 24 * 60 * 60 * 1000);

const member = {
  isAdmin: false,
  accessGrantedUntil: null,
  subscriptionStatus: null,
  currentPeriodEnd: null,
} as const;

describe("memberStatus", () => {
  it("puts someone never granted in the queue for their first claim", () => {
    expect(memberStatus(member, now)).toBe("pending");
  });

  it("counts a grant with more than a week to go as active", () => {
    expect(memberStatus({ ...member, accessGrantedUntil: days(20) }, now)).toBe("active");
  });

  it("flags a grant ending within a week as expiring", () => {
    expect(memberStatus({ ...member, accessGrantedUntil: days(3) }, now)).toBe("expiring");
  });

  it("flags a grant ending exactly a week from now as expiring", () => {
    expect(memberStatus({ ...member, accessGrantedUntil: days(7) }, now)).toBe("expiring");
  });

  /** Same boundary as the paywall: at the instant it ends, access has ended. */
  it("counts a grant that ends right now as lapsed, not expiring", () => {
    expect(memberStatus({ ...member, accessGrantedUntil: now }, now)).toBe("lapsed");
  });

  it("counts a grant that ran out as lapsed", () => {
    expect(memberStatus({ ...member, accessGrantedUntil: days(-2) }, now)).toBe("lapsed");
  });

  /** Repeat has no grant to run out, so nothing for Aron to invoice. */
  it("counts a member paying through Repeat as active", () => {
    expect(
      memberStatus({ ...member, subscriptionStatus: "active", currentPeriodEnd: days(2) }, now),
    ).toBe("active");
  });
});

describe("extendGrant", () => {
  it("starts from now for a member who has never had access", () => {
    expect(extendGrant(null, now, 30)).toEqual(days(30));
  });

  /** Paying early must not cost them the days they had left. */
  it("adds to the current end while a grant is still running", () => {
    expect(extendGrant(days(5), now, 30)).toEqual(days(35));
  });

  /** Paying late must not backdate a month they could not use. */
  it("starts from now once a grant has run out", () => {
    expect(extendGrant(days(-10), now, 30)).toEqual(days(30));
  });
});
