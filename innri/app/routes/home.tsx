import { getAuth } from "@clerk/react-router/server";
import { redirect } from "react-router";

import type { Route } from "./+types/home";

/**
 * Entry redirect. The rest of the chain lands with the pieces it depends on:
 *
 *   phase 6  no active subscription → /subscribe
 *   phase 3  onboarding incomplete  → /onboarding
 *   else                            → /dashboard
 */
export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  if (!userId) {
    return redirect("/sign-in");
  }

  return redirect("/dashboard");
}
