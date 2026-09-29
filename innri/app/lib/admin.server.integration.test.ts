import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createMember, reload, resetDatabase } from "../../test/db";
import { db } from "~/db";
import { onboarding, users } from "~/db/schema";

import { grantAccess, listMembers, revokeAccess } from "./admin.server";

const now = new Date("2026-10-15T12:00:00Z");

const days = (count: number) => new Date(now.getTime() + count * 24 * 60 * 60 * 1000);

const answer = (userId: string, completedAt: Date, weightKg: number) => ({
  userId,
  goal: "fitutap" as const,
  sessionsPerWeek: 3,
  weightKg,
  heightCm: 181,
  age: 41,
  sex: "karl" as const,
  activityLevel: "lett" as const,
  confirmedAdult: true,
  completedAt,
});

beforeEach(async () => {
  await resetDatabase();
});

describe("listMembers", () => {
  it("lists the queued and the granted, and leaves out the rest", async () => {
    const queued = await createMember({ readyAt: days(-1) });
    const granted = await createMember({ accessGrantedUntil: days(10) });

    await createMember();
    await createMember({ isAdmin: true, readyAt: days(-1) });

    const listed = await listMembers(now);

    expect(listed.map((member) => member.id).sort()).toEqual([queued.id, granted.id].sort());
  });

  it("attaches each member's newest answers and their status", async () => {
    const member = await createMember({ readyAt: days(-1) });

    await db
      .insert(onboarding)
      .values([answer(member.id, days(-5), 95), answer(member.id, days(-1), 92)]);

    const [listed] = await listMembers(now);

    expect(listed?.status).toBe("pending");
    expect(listed?.answers?.weightKg).toBe(92);
  });
});

describe("grantAccess", () => {
  it("opens thirty days for a member waiting on their first claim", async () => {
    const member = await createMember({ readyAt: days(-1) });

    expect(await grantAccess(member.id, 30, null, now)).toBe("granted");
    expect((await reload(member.id)).accessGrantedUntil).toEqual(days(30));
  });

  it("extends a running grant from its end, not from today", async () => {
    const member = await createMember({ accessGrantedUntil: days(3) });

    await grantAccess(member.id, 30, days(3), now);

    expect((await reload(member.id)).accessGrantedUntil).toEqual(days(33));
  });

  /** One paid claim must never become two months. */
  it("applies a double-click once", async () => {
    const member = await createMember({ readyAt: days(-1) });

    expect(await grantAccess(member.id, 30, null, now)).toBe("granted");
    expect(await grantAccess(member.id, 30, null, now)).toBe("stale");
    expect((await reload(member.id)).accessGrantedUntil).toEqual(days(30));
  });

  /** The one-off tester grant is SQL; the page only ever sees milliseconds. */
  it("extends a grant set by hand with sub-millisecond precision", async () => {
    const member = await createMember();

    await db
      .update(users)
      .set({ accessGrantedUntil: sql`'2026-10-18T12:00:00.123456Z'::timestamptz` })
      .where(eq(users.id, member.id));

    const seen = (await reload(member.id)).accessGrantedUntil;

    expect(await grantAccess(member.id, 30, seen, now)).toBe("granted");
  });

  it("reports an unknown member instead of throwing", async () => {
    expect(await grantAccess("00000000-0000-0000-0000-000000000000", 30, null, now)).toBe(
      "unknown",
    );
  });
});

describe("revokeAccess", () => {
  it("sends a mistaken grant back to the queue", async () => {
    const member = await createMember({ readyAt: days(-1), accessGrantedUntil: days(30) });

    await revokeAccess(member.id);

    const [listed] = await listMembers(now);

    expect(listed?.status).toBe("pending");
  });
});
