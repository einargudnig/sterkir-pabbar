import { verifyWebhook } from "@clerk/backend/webhooks";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { users } from "~/db/schema";

import type { Route } from "./+types/clerk-webhook";

/**
 * Keeps the `users` table in step with Clerk.
 *
 * Clerk owns identity; this table owns everything the app needs to answer
 * quickly — above all whether someone is paid up. A row has to exist before
 * onboarding answers or a subscription can reference it, so it is created the
 * moment Clerk says the account exists rather than lazily on first request.
 *
 * `verifyWebhook` checks the Standard Webhooks signature against
 * `CLERK_WEBHOOK_SIGNING_SECRET`. An unsigned or missigned request is rejected
 * before it reaches the database — this endpoint is public by necessity, so the
 * signature is the only thing standing between it and anyone on the internet.
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let event;

  try {
    event = await verifyWebhook(request);
  } catch {
    // Deliberately terse: a caller who fails verification learns nothing about
    // why, and the detail would only help someone probing the endpoint.
    return new Response("Invalid signature", { status: 401 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const primaryId = event.data.primary_email_address_id;

      const email =
        event.data.email_addresses.find((address) => address.id === primaryId)?.email_address ??
        null;

      /**
       * Upsert rather than insert. Clerk delivers at least once, and
       * `user.updated` arrives for accounts we already hold, so the same event
       * landing twice must be a no-op rather than a duplicate row.
       */
      await db.insert(users).values({ clerkUserId: event.data.id, email }).onConflictDoUpdate({
        target: users.clerkUserId,
        set: { email },
      });

      break;
    }

    case "user.deleted": {
      /**
       * Someone deleting their account expects their data gone. The foreign
       * keys cascade, so onboarding answers, macro snapshots and plan
       * assignments go with the row. `kling_events` is deliberately NOT
       * cascaded — it sets user_id to null instead, because the payment record
       * is an accounting artefact that has to outlive the account.
       */
      if (event.data.id) {
        await db.delete(users).where(eq(users.clerkUserId, event.data.id));
      }

      break;
    }

    default:
      // Every other Clerk event is acknowledged and ignored. Returning an error
      // would make Clerk retry something we will never handle.
      break;
  }

  return new Response(null, { status: 204 });
}
