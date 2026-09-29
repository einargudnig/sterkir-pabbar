import { redirect } from "react-router";

import { requireActiveAccess } from "~/lib/subscription.server";

import type { Route } from "./+types/home";

/**
 * Entry redirect — the whole chain in one place, in the order the member
 * experiences it:
 *
 *   not signed in            → /sign-in
 *   onboarding incomplete    → /onboarding
 *   no access yet            → /waiting   (Aron invoices, then grants)
 *   else                     → /dashboard
 *
 * `requireActiveAccess` builds on `requireUser`, which creates the database row
 * if the Clerk webhook has not landed yet.
 */
export async function loader(args: Route.LoaderArgs) {
  await requireActiveAccess(args);

  return redirect("/dashboard");
}
