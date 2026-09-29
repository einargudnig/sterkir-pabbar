import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createMember, reload, resetDatabase } from "../../test/db";
import { db } from "~/db";
import { onboarding, users } from "~/db/schema";

import {
  cancelClaim,
  grantAccess,
  listMembers,
  listUsers,
  markClaimPaid,
  revokeAccess,
  sendClaim,
} from "./admin.server";

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

describe("listUsers", () => {
  it("lists everyone who signed up, finished or not, and leaves out admins", async () => {
    const stopped = await createMember();
    const queued = await createMember({ readyAt: days(-1) });

    await createMember({ isAdmin: true });

    const listed = await listUsers(now);

    expect(listed.map((user) => user.id).sort()).toEqual([stopped.id, queued.id].sort());
    expect(listed.find((user) => user.id === stopped.id)?.answers).toBeNull();
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

describe("claims", () => {
  const openClaimOf = async (userId: string) =>
    (await listUsers(now)).find((user) => user.id === userId)?.openClaim ?? null;

  it("records a sent claim, and refuses a second while the first is open", async () => {
    const member = await createMember({ readyAt: days(-1) });

    expect(await sendClaim(member.id, 30, now)).toBe("sent");
    expect(await sendClaim(member.id, 30, now)).toBe("open");

    expect((await openClaimOf(member.id))?.days).toBe(30);
  });

  it("opens access for the claimed days when paid, once", async () => {
    const member = await createMember({ readyAt: days(-1) });

    await sendClaim(member.id, 30, days(-2));

    const claim = await openClaimOf(member.id);

    expect(await markClaimPaid(claim?.id ?? "", now)).toBe("paid");
    expect(await markClaimPaid(claim?.id ?? "", now)).toBe("stale");

    expect((await reload(member.id)).accessGrantedUntil).toEqual(days(30));
    expect(await openClaimOf(member.id)).toBeNull();
  });

  it("extends from the current end when a renewal is paid early", async () => {
    const member = await createMember({ readyAt: days(-40), accessGrantedUntil: days(5) });

    await sendClaim(member.id, 30, now);

    const claim = await openClaimOf(member.id);

    await markClaimPaid(claim?.id ?? "", now);

    expect((await reload(member.id)).accessGrantedUntil).toEqual(days(35));
  });

  it("lets a new claim be sent once the last one is paid", async () => {
    const member = await createMember({ readyAt: days(-1) });

    await sendClaim(member.id, 30, now);
    await markClaimPaid((await openClaimOf(member.id))?.id ?? "", now);

    expect(await sendClaim(member.id, 30, now)).toBe("sent");
  });

  it("withdraws an open claim without touching access", async () => {
    const member = await createMember({ readyAt: days(-1) });

    await sendClaim(member.id, 30, now);
    await cancelClaim((await openClaimOf(member.id))?.id ?? "");

    expect(await openClaimOf(member.id)).toBeNull();
    expect((await reload(member.id)).accessGrantedUntil).toBeNull();
  });

  it("never deletes a paid claim", async () => {
    const member = await createMember({ readyAt: days(-1) });

    await sendClaim(member.id, 30, now);

    const claim = await openClaimOf(member.id);

    await markClaimPaid(claim?.id ?? "", now);
    await cancelClaim(claim?.id ?? "");

    expect((await listUsers(now)).find((user) => user.id === member.id)?.lastPaidClaim?.id).toBe(
      claim?.id,
    );
  });
});
