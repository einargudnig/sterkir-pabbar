import { randomUUID } from "node:crypto";

import { serverEnv } from "~/lib/env.server";
import { toNudge, webhookBodySchema } from "~/lib/repeat";
import { REPEAT_SECRET_HEADER, secretMatches } from "~/lib/secret.server";
import { recordDelivery, syncSubscription } from "~/lib/subscription.server";

import type { Route } from "./+types/repeat-webhook";

/**
 * Receives Repeat's webhooks — as a nudge, never as a message.
 *
 * Repeat does not sign deliveries. The shared secret in `x-webhook-secret`
 * keeps strangers out, but even a correct secret only buys a re-read: the body
 * names subscriptions, and each one is fetched from Repeat's API with our key
 * and written from THAT response. A forged body can at most make us look up
 * the truth sooner.
 *
 * Repeat waits 10 s and never retries. A failed sync answers 502 so the
 * delivery shows as failed in Repeat's log, where it can be replayed by hand —
 * and the nightly sweep catches it either way.
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = serverEnv();

  if (!secretMatches(request.headers.get(REPEAT_SECRET_HEADER), env.REPEAT_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await request.text();

  let json;

  try {
    json = JSON.parse(payload);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const body = webhookBodySchema.safeParse(json);

  if (!body.success) {
    return new Response("Not a Repeat webhook", { status: 400 });
  }

  const nudge = toNudge(body.data);

  const results = await Promise.allSettled(nudge.subscriptionIds.map(syncSubscription));

  const applied = results.find((result) => result.status === "fulfilled" && result.value.applied);

  const userId =
    applied?.status === "fulfilled" && applied.value.applied ? applied.value.userId : null;

  /**
   * A test-fire from Repeat's dashboard may not carry a delivery id. It is
   * still logged, under an id that says where it came from.
   */
  const deliveryId = request.headers.get("x-repeat-delivery-id") ?? `unlabelled-${randomUUID()}`;

  await recordDelivery({ deliveryId, nudge, userId, payload });

  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    console.error("repeat-webhook: sync failed", deliveryId, failures);

    return new Response("Sync failed", { status: 502 });
  }

  return new Response("OK", { status: 200 });
}
