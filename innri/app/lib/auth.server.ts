import { getAuth } from "@clerk/react-router/server";
import { eq } from "drizzle-orm";
import { redirect } from "react-router";

import { db } from "~/db";
import { users } from "~/db/schema";

/**
 * There are three levels of gate in this app, and they are easy to confuse:
 *
 *   public              /sign-in, /sign-up
 *   signed in           /subscribe, /onboarding, /admin — you must have an
 *                       account to subscribe, to answer the questionnaire, or
 *                       to be Aron
 *   signed in + paid    everything under layouts/member.tsx
 *
 * The third is enforced by the member layout's loader. The second is
 * `requireUserId`, because those routes deliberately sit outside that layout —
 * they have their own full-width chrome and must stay reachable to someone who
 * has not paid yet, which is the whole point of the paywall.
 */

type AuthArgs = Parameters<typeof getAuth>[0];

export const requireUserId = async (args: AuthArgs): Promise<string> => {
  const { userId } = await getAuth(args);

  if (!userId) {
    throw redirect("/sign-in");
  }

  return userId;
};

type UserRow = typeof users.$inferSelect;

/**
 * The signed-in member's database row, created on first sight if missing.
 *
 * The Clerk webhook is what normally creates this row, and it usually wins the
 * race. But webhooks are not a guarantee: Clerk can retry for minutes, the
 * endpoint can be mid-deploy, the signing secret can be rotated, and anyone who
 * signed up before the endpoint existed has no row at all. Every one of those
 * ends with a paying member hitting a page that cannot find them.
 *
 * So the row is created here too. The webhook stays — it is what backfills the
 * email and handles deletion — but nothing downstream has to assume it ran.
 */
export const requireUser = async (args: AuthArgs): Promise<UserRow> => {
  const clerkUserId = await requireUserId(args);

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });

  if (existing) {
    return existing;
  }

  /**
   * `onConflictDoNothing` rather than a plain insert: two requests from the
   * same new member can arrive together — a page and its data fetch — and both
   * find no row. One insert wins, the other returns nothing and re-reads.
   */
  const inserted = await db
    .insert(users)
    .values({ clerkUserId })
    .onConflictDoNothing({ target: users.clerkUserId })
    .returning();

  const created = inserted[0];

  if (created) {
    return created;
  }

  const raced = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });

  if (!raced) {
    throw new Error(`Could not create or read the user row for ${clerkUserId}.`);
  }

  return raced;
};
