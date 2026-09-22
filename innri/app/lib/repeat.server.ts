import type { z } from "zod";

import { serverEnv } from "~/lib/env.server";
import {
  cancellationPreviewSchema,
  cancellationResultSchema,
  orderCreatedSchema,
  repeatProductSchema,
  repeatSubscriptionSchema,
  subscriptionListSchema,
} from "~/lib/repeat";

/**
 * Every call this app makes to Repeat. Server-only: the key is full-tier and can
 * create orders and cancel subscriptions.
 *
 * Every response is parsed with Zod before anything reads it. Repeat's OpenAPI
 * marks fields optional that the docs describe as always present, so the
 * schemas in `repeat.ts` decide what a missing field means rather than leaving
 * it to whoever reads the value.
 */

const BASE_URL = "https://repeat.is/api/v1";

/**
 * Reads answer fast, and the webhook handler has 10 s before Repeat gives up
 * on it. An order waits longer: it charges a card through the acquirer, and
 * abandoning it early leaves the one outcome we cannot report — "maybe".
 */
const READ_TIMEOUT_MS = 8000;

const ORDER_TIMEOUT_MS = 25000;

export class RepeatError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = "RepeatError";
    this.status = status;
  }
}

type Method = "GET" | "POST";

const call = async <Schema extends z.ZodType>(
  method: Method,
  path: string,
  schema: Schema,
  json: string | null = null,
  timeoutMs = READ_TIMEOUT_MS,
): Promise<z.infer<Schema>> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "x-api-key": serverEnv().REPEAT_API_KEY,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: json,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    /**
     * The body is kept for the log only. It can carry Repeat's reason for a
     * declined card, which is useful to Einar and none of a member's business.
     */
    const detail = await response.text().catch(() => "");

    throw new RepeatError(
      `Repeat ${method} ${path} failed: ${response.status} ${detail.slice(0, 500)}`,
      response.status,
    );
  }

  return schema.parse(await response.json());
};

export const getSubscription = (uuid: string) =>
  call("GET", `/subscriptions/${encodeURIComponent(uuid)}/`, repeatSubscriptionSchema);

/** Active subscriptions to the members' area product held under this email. */
export const findActiveSubscriptionIds = async (email: string): Promise<string[]> => {
  const query = new URLSearchParams({ email, active: "true", page_size: "50" });
  const list = await call("GET", `/subscriptions/?${query}`, subscriptionListSchema);
  const product = serverEnv().REPEAT_PRODUCT_UUID;

  return list.results.filter((row) => row.product.uuid === product).map((row) => row.uuid);
};

export const getProduct = (uuid: string) =>
  call("GET", `/products/${encodeURIComponent(uuid)}/`, repeatProductSchema);

type OrderInput = {
  readonly cardToken: string;
  readonly email: string;
  readonly name: string;
  /** Our `users.id`, so an order in Repeat's dashboard traces to a member. */
  readonly userId: string;
};

/**
 * Charges the card and creates the subscription in one call. Repeat creates a
 * subscription automatically for a SUBSCRIPTION-type product and returns its
 * uuid in `subscriptions_created` — which is how the mirror is written before
 * the member's browser even hears back, with no webhook in the path.
 */
export const createOrder = (input: OrderInput) =>
  call(
    "POST",
    "/orders/",
    orderCreatedSchema,
    JSON.stringify({
      customer: { email: input.email, name: input.name },
      products: [{ uuid: serverEnv().REPEAT_PRODUCT_UUID, quantity: 1 }],
      payment_method: "CARD",
      currency: "ISK",
      card_token: input.cardToken,
      external_ref: input.userId,
    }),
    ORDER_TIMEOUT_MS,
  );

/** A dry run: nothing is recorded and no email is sent. */
export const previewCancellation = (uuid: string) =>
  call("GET", `/subscriptions/${encodeURIComponent(uuid)}/cancel/`, cancellationPreviewSchema);

/**
 * Cancels through Aron's configured policy — notice, commitment, statistics and
 * the customer's email all happen as if the member had used Repeat's portal.
 * Never `PATCH active: false`: that is Repeat's admin kill switch and skips all
 * of it.
 */
export const cancelSubscription = (uuid: string) =>
  call(
    "POST",
    `/subscriptions/${encodeURIComponent(uuid)}/cancel/`,
    cancellationResultSchema,
    JSON.stringify({ reason_code: "OTHER" }),
  );
