import { redirect } from "react-router";

import { hasCompletedOnboarding } from "~/lib/onboarding.server";
import { requireActiveAccess } from "~/lib/subscription.server";

import type { Route } from "./+types/home";

/**
 * Entry redirect — the whole chain in one place, in the order the member
 * experiences it:
 *
 *   not signed in            → /sign-in
 *   no subscription          → /subscribe
 *   onboarding incomplete    → /onboarding
 *   else                     → /dashboard
 *
 * `requireActiveAccess` builds on `requireUser`, which creates the database row
 * if the Clerk webhook has not landed yet.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireActiveAccess(args);

  if (!(await hasCompletedOnboarding(user.id))) {
    return redirect("/onboarding");
  }

  return redirect("/dashboard");
}
