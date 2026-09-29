import { describe, expect, it } from "vitest";

import { hasActiveAccess } from "./access";

const now = new Date("2026-10-15T12:00:00Z");

const later = new Date("2026-11-01T00:00:00Z");

const earlier = new Date("2026-10-01T00:00:00Z");

const member = { isAdmin: false, accessGrantedUntil: null } as const;

describe("hasActiveAccess", () => {
  it("shuts out someone who has never been granted access", () => {
    expect(hasActiveAccess(member, now)).toBe(false);
  });

  it("lets in a grant that has not expired", () => {
    expect(hasActiveAccess({ ...member, accessGrantedUntil: later }, now)).toBe(true);
  });

  it("does not let an expired grant in", () => {
    expect(hasActiveAccess({ ...member, accessGrantedUntil: earlier }, now)).toBe(false);
  });

  /** At the boundary instant itself, access has ended. */
  it("shuts out at the exact moment the grant ends", () => {
    expect(hasActiveAccess({ ...member, accessGrantedUntil: now }, now)).toBe(false);
  });

  it("lets in one millisecond before the grant ends", () => {
    const justAfter = new Date(now.getTime() + 1);

    expect(hasActiveAccess({ ...member, accessGrantedUntil: justAfter }, now)).toBe(true);
  });

  it("always lets an admin in", () => {
    expect(hasActiveAccess({ ...member, isAdmin: true }, now)).toBe(true);
  });
});
