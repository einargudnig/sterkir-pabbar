import { serverEnv } from "~/lib/env.server";
import { bearerToken, secretMatches } from "~/lib/secret.server";
import { syncAllSubscriptions } from "~/lib/subscription.server";

import type { Route } from "./+types/repeat-sync";

/**
 * Nightly reconciliation, run by Vercel cron (`innri/vercel.json`).
 *
 * Not optional. Repeat never retries a webhook, so without this a single lost
 * `subscription_deactivated` would leave a lapsed member inside indefinitely —
 * or, more exactly, until the grace lease in `toMirror` runs out.
 *
 * A loader because Vercel cron sends GET.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const env = serverEnv();

  if (!secretMatches(bearerToken(request.headers.get("authorization")), env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncAllSubscriptions();

  return Response.json(result, { status: result.failed.length > 0 ? 500 : 200 });
}
