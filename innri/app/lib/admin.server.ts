import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "~/db";
import { onboarding, users } from "~/db/schema";
import { extendGrant, memberStatus } from "~/lib/members";

/**
 * Reads and writes behind /admin: who is waiting for a claim, who is due the
 * next one, and Aron marking a claim paid.
 *
 * Every write here touches `access_granted_until` only. The Repeat mirror is
 * never written from this page, so turning Repeat on later cannot be undone by
 * a click Aron made months earlier.
 */

/**
 * Everyone Aron has something to do about: they finished the questionnaire,
 * or they were granted access at some point. Admins are left out — Aron does
 * not invoice himself.
 *
 * Two queries rather than a lateral join. At the 50–100 members this flow is
 * meant for, fetching every onboarding row for them costs nothing, and picking
 * the newest per member in code keeps the query obvious.
 */
export const listMembers = async (now: Date) => {
  const members = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.isAdmin, false),
        or(isNotNull(users.readyAt), isNotNull(users.accessGrantedUntil)),
      ),
    );

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

  return members.map((member) => ({
    ...member,
    status: memberStatus(member, now),
    answers: latest.get(member.id) ?? null,
  }));
};

export type AdminMember = Awaited<ReturnType<typeof listMembers>>[number];

export type GrantResult = "granted" | "stale" | "unknown";

/**
 * Aron marks a claim paid.
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
