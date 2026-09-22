import { redirect } from "react-router";

import { requireUser } from "~/lib/auth.server";
import { hasCompletedOnboarding } from "~/lib/onboarding.server";

import type { Route } from "./+types/home";

/**
 * Entry redirect — the whole chain in one place, in the order the member
 * experiences it:
 *
 *   not signed in            → /sign-in
 *   phase 6  no subscription → /subscribe
 *   onboarding incomplete    → /onboarding
 *   else                     → /dashboard
 *
 * `requireUser` rather than `getAuth`, because the next question needs the
 * database row and it creates one if the Clerk webhook has not landed yet.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireUser(args);

  if (!(await hasCompletedOnboarding(user.id))) {
    return redirect("/onboarding");
  }

  return redirect("/dashboard");
}
