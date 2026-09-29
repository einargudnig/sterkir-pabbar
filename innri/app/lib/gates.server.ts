import { redirect } from "react-router";

import type { users } from "~/db/schema";
import { hasActiveAccess } from "~/lib/access";
import { requireUser } from "~/lib/auth.server";
import { hasCompletedOnboarding } from "~/lib/onboarding.server";

/**
 * The two member gates, applied by the layouts rather than by each route:
 * `layouts/member.tsx` requires a finished questionnaire, and `layouts/paid.tsx`
 * inside it requires access.
 */

type UserRow = typeof users.$inferSelect;

type AuthArgs = Parameters<typeof requireUser>[0];

/**
 * Where a member without access lands: the member area, with the paid tabs
 * locked and a banner saying access opens once the claim is paid. Fróðleikur
 * is the part they can read in the meantime.
 */
export const PREVIEW_LANDING = "/articles";

/**
 * The first half of the member gate: questionnaire answered. The member layout
 * calls `requireOnboarded` — a member who has not paid yet still gets the
 * app's chrome and Fróðleikur, rather than a dead end.
 *
 * Questionnaire first because finishing it is how a
 * member asks to be invoiced — it puts them in Aron's queue on /admin.
 *
 * Admins skip it: Aron runs /admin from inside the member layout and has no
 * plan of his own. The plan tabs cover a missing assignment with an empty state.
 *
 * Split from the Clerk lookup so the rule is tested against real rows, with no
 * session to fake.
 */
export const assertOnboarded = async (user: UserRow): Promise<UserRow> => {
  if (!user.isAdmin && !(await hasCompletedOnboarding(user.id))) {
    throw redirect("/onboarding");
  }

  return user;
};

/**
 * The second half: access. The paid layout (`layouts/paid.tsx`) calls
 * `requireActiveAccess`, so the plan and macros are refused on the server to
 * anyone who has not paid — a locked tab is only the visible half.
 */
export const assertAccess = (user: UserRow, now: Date): UserRow => {
  if (!hasActiveAccess(user, now)) {
    throw redirect(PREVIEW_LANDING);
  }

  return user;
};

export const requireOnboarded = async (args: AuthArgs): Promise<UserRow> =>
  assertOnboarded(await requireUser(args));

export const requireActiveAccess = async (args: AuthArgs): Promise<UserRow> =>
  assertAccess(await requireOnboarded(args), new Date());
