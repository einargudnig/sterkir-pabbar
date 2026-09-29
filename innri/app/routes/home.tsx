import { redirect } from "react-router";

import { hasActiveAccess } from "~/lib/access";
import { PREVIEW_LANDING, requireOnboarded } from "~/lib/subscription.server";

import type { Route } from "./+types/home";

/**
 * Entry redirect — the whole chain in one place, in the order the member
 * experiences it:
 *
 *   not signed in            → /sign-in
 *   onboarding incomplete    → /onboarding
 *   no access yet            → /articles  (locked tabs, a banner; Aron invoices, then grants)
 *   else                     → /dashboard
 *
 * `requireOnboarded` builds on `requireUser`, which creates the database row
 * if the Clerk webhook has not landed yet.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireOnboarded(args);

  return redirect(hasActiveAccess(user, new Date()) ? "/dashboard" : PREVIEW_LANDING);
}
