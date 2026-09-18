import { redirect } from "react-router";

import { requireUserId } from "~/lib/auth.server";

import type { Route } from "./+types/index";

/**
 * /dashboard has no content of its own — the first tab is the landing tab.
 *
 * The auth check is repeated here even though the member layout already guards
 * this subtree: layout and child loaders run in parallel, so without it this
 * redirect wins the race and a signed-out visitor bounces through
 * /dashboard/workouts before reaching /sign-in. Correct either way, but one hop
 * instead of two.
 */
export async function loader(args: Route.LoaderArgs) {
  await requireUserId(args);

  return redirect("/dashboard/workouts");
}
