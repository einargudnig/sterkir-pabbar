import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "~/db";
import { claims, onboarding, users } from "~/db/schema";
import { extendGrant, inInvoicingQueue, memberStatus } from "~/lib/members";

/**
 * Reads and writes behind /admin: everyone who has signed up, who is waiting
 * for a claim, who is due the next one, and Aron marking a claim paid.
 *
 * Every write here touches `access_granted_until` and `claims` only — the whole
 * of how a member pays.
 */

/**
 * Every non-admin user, newest sign-up first, with their newest questionnaire
 * answers and where they stand. Admins are left out — Aron does not invoice
 * himself.
 *
 * Two queries rather than a lateral join. At the 50–100 members this flow is
 * meant for, fetching every onboarding row for them costs nothing, and picking
 * the newest per member in code keeps the query obvious.
 */
export const listUsers = async (now: Date) => {
  const members = await db
    .select()
    .from(users)
    .where(eq(users.isAdmin, false))
    .orderBy(desc(users.createdAt));

  const ids = members.map((member) => member.id);

  const answers =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(onboarding)
          .where(inArray(onboarding.userId, ids))
          .orderBy(desc(onboarding.completedAt));

  const latest = new Map<string, (typeof answers)[number]>();

  for (const row of answers) {
    if (!latest.has(row.userId)) {
      latest.set(row.userId, row);
    }
  }

  const claimRows =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(claims)
          .where(inArray(claims.userId, ids))
          .orderBy(desc(claims.sentAt));

  const open = new Map<string, (typeof claimRows)[number]>();
  const lastPaid = new Map<string, (typeof claimRows)[number]>();

  for (const claim of claimRows) {
    const into = claim.paidAt === null ? open : lastPaid;

    if (!into.has(claim.userId)) {
      into.set(claim.userId, claim);
    }
  }

  return members.map((member) => ({
    ...member,
    status: memberStatus(member, now),
    answers: latest.get(member.id) ?? null,
    openClaim: open.get(member.id) ?? null,
    lastPaidClaim: lastPaid.get(member.id) ?? null,
  }));
};

/** The invoicing queue: the users Aron has something to do about. */
export const listMembers = async (now: Date) => (await listUsers(now)).filter(inInvoicingQueue);

export type AdminMember = Awaited<ReturnType<typeof listMembers>>[number];

export type GrantResult = "granted" | "stale" | "unknown";

/**
 * Aron gives access without a claim — comping a friend, or repairing a payment
 * that went through outside the app.
 *
 * `seenUntil` is the end date the page showed when he clicked. The update
 * applies only if it is still the stored value, so a double-click, or a second
 * tab, extends once and reports "stale" the second time — one paid claim must
 * never become two months.
 */
export const grantAccess = async (
  userId: string,
  days: number,
  seenUntil: Date | null,
  now: Date,
): Promise<GrantResult> => {
  const member = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (!member) {
    return "unknown";
  }

  const updated = await db
    .update(users)
    .set({ accessGrantedUntil: extendGrant(seenUntil, now, days) })
    .where(
      and(
        eq(users.id, userId),
        seenUntil === null
          ? isNull(users.accessGrantedUntil)
          : /**
             * Postgres keeps microseconds and a Date round-tripped through the
             * page keeps milliseconds — a grant set by hand in SQL with now()
             * would otherwise never match and read as stale forever.
             */
            sql`date_trunc('milliseconds', ${users.accessGrantedUntil}) = ${seenUntil.toISOString()}::timestamptz`,
      ),
    )
    .returning({ id: users.id });

  return updated.length > 0 ? "granted" : "stale";
};

/**
 * Undo a grant made by mistake. Clears it rather than ending it now, so the
 * member goes back to waiting for a claim instead of showing as lapsed.
 */
export const revokeAccess = async (userId: string): Promise<void> => {
  await db.update(users).set({ accessGrantedUntil: null }).where(eq(users.id, userId));
};

export type SendResult = "sent" | "open";

/**
 * Aron has sent a claim to the member's online bank. Reports "open" instead of
 * inserting when one is already waiting — the partial unique index on
 * `claims` makes that a no-op rather than a second claim.
 */
export const sendClaim = async (userId: string, days: number, now: Date): Promise<SendResult> => {
  const inserted = await db
    .insert(claims)
    .values({ userId, days, sentAt: now })
    .onConflictDoNothing()
    .returning({ id: claims.id });

  return inserted.length > 0 ? "sent" : "open";
};

export type PaidResult = "paid" | "stale";

/**
 * The claim was paid: mark it, and extend the member's access by the days it
 * was sent for, in one transaction.
 *
 * Only an open claim can be paid, so a double-click extends once and reports
 * "stale" the second time — one paid claim must never become two months.
 */
export const markClaimPaid = async (claimId: string, now: Date): Promise<PaidResult> =>
  db.transaction(async (tx) => {
    const [claim] = await tx
      .update(claims)
      .set({ paidAt: now })
      .where(and(eq(claims.id, claimId), isNull(claims.paidAt)))
      .returning();

    if (!claim) {
      return "stale";
    }

    const [member] = await tx
      .select({ until: users.accessGrantedUntil })
      .from(users)
      .where(eq(users.id, claim.userId))
      .for("update");

    await tx
      .update(users)
      .set({ accessGrantedUntil: extendGrant(member?.until ?? null, now, claim.days) })
      .where(eq(users.id, claim.userId));

    return "paid";
  });

/**
 * Withdraw a claim sent by mistake. Deleted rather than kept: an unpaid claim
 * that was never meant to exist is not history worth reading.
 */
export const cancelClaim = async (claimId: string): Promise<void> => {
  await db.delete(claims).where(and(eq(claims.id, claimId), isNull(claims.paidAt)));
};
