import { redirect } from "react-router";

import type { Route } from "./+types/waiting";

/**
 * Retired: a member waiting for their claim now sees the member area with the
 * paid tabs locked and a banner, not a page of their own. Kept as a redirect
 * so an old link or bookmark still lands somewhere sensible — the entry
 * redirect sends them wherever their state says.
 */
export function loader(_args: Route.LoaderArgs) {
  return redirect("/");
}
