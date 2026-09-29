import { beforeEach, describe, expect, it } from "vitest";

import { createMember, resetDatabase } from "../../test/db";
import { db } from "~/db";
import { planAssignments } from "~/db/schema";

import { assertAccess, assertOnboarded, PREVIEW_LANDING } from "./gates.server";

/**
 * The two halves of the member gate, against real rows. The member layout
 * applies the first, the paid layout both.
 *
 * The case that matters is the unpaid member: through the first, so they can
 * read Fróðleikur, and refused by the second, so the plan never reaches them.
 */

const now = new Date("2026-10-15T12:00:00Z");

const days = (count: number) => new Date(now.getTime() + count * 24 * 60 * 60 * 1000);

const onboarded = async (fields: Parameters<typeof createMember>[0] = {}) => {
  const member = await createMember(fields);

  await db.insert(planAssignments).values({ userId: member.id, sanityPlanId: "plan-test" });

  return member;
};

/** Where the gate redirected, or null when it let the member through. */
const redirectOf = async <T>(run: () => T | Promise<T>): Promise<string | null> => {
  try {
    await run();

    return null;
  } catch (thrown) {
    if (thrown instanceof Response) {
      return thrown.headers.get("Location");
    }

    throw thrown;
  }
};

beforeEach(async () => {
  await resetDatabase();
});

describe("assertOnboarded", () => {
  it("sends someone who has not finished the questionnaire back to it", async () => {
    const member = await createMember();

    expect(await redirectOf(() => assertOnboarded(member))).toBe("/onboarding");
  });

  it("lets an unpaid member who finished it into the member area", async () => {
    const member = await onboarded({ readyAt: days(-1) });

    expect(await redirectOf(() => assertOnboarded(member))).toBeNull();
  });

  it("lets an admin in without a questionnaire, so /admin has the app's chrome", async () => {
    const admin = await createMember({ isAdmin: true });

    expect(await redirectOf(() => assertOnboarded(admin))).toBeNull();
  });
});

describe("assertAccess", () => {
  it("refuses an unpaid member, sending them to the preview", async () => {
    const member = await onboarded({ readyAt: days(-1) });

    expect(await redirectOf(() => assertAccess(member, now))).toBe(PREVIEW_LANDING);
  });

  it("refuses a member whose grant ran out", async () => {
    const member = await onboarded({ accessGrantedUntil: days(-1) });

    expect(await redirectOf(() => assertAccess(member, now))).toBe(PREVIEW_LANDING);
  });

  it("lets a paid member through", async () => {
    const member = await onboarded({ accessGrantedUntil: days(10) });

    expect(await redirectOf(() => assertAccess(member, now))).toBeNull();
  });

  it("lets an admin through without a grant", async () => {
    const member = await onboarded({ isAdmin: true });

    expect(await redirectOf(() => assertAccess(member, now))).toBeNull();
  });
});
