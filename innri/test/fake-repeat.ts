import type { z } from "zod";
import { vi } from "vitest";

import type { repeatSubscriptionSchema } from "~/lib/repeat";

/**
 * Repeat's API as the app sees it, answered in-process.
 *
 * Installed as the global `fetch`, which is the seam `repeat.server.ts`
 * actually calls — so URL building, the API-key header and Zod parsing of the
 * response all run for real. Only Repeat's side of the wire is invented.
 *
 * Any request that is not to Repeat throws: a test that reaches the real
 * internet should fail, not pass slowly.
 */

type SubscriptionBody = z.input<typeof repeatSubscriptionSchema>;

type ListedSubscription = {
  readonly uuid: string;
  readonly productUuid: string;
};

const REPEAT_ORIGIN = "https://repeat.is";

const API_PREFIX = "/api/v1";

export const installFakeRepeat = () => {
  const subscriptions = new Map<string, SubscriptionBody>();
  const byEmail = new Map<string, readonly ListedSubscription[]>();
  const down = new Set<string>();
  const requests: string[] = [];

  const respond = (path: string, url: URL): Response => {
    const list = path === "/subscriptions/";

    if (list) {
      const rows = byEmail.get(url.searchParams.get("email") ?? "") ?? [];

      return Response.json({
        results: rows.map((row) => ({ uuid: row.uuid, product: { uuid: row.productUuid } })),
      });
    }

    const one = path.match(/^\/subscriptions\/([^/]+)\/$/);
    const uuid = one?.[1] === undefined ? null : decodeURIComponent(one[1]);

    if (uuid === null) {
      return new Response("Not found", { status: 404 });
    }

    if (down.has(uuid)) {
      return new Response("Service unavailable", { status: 503 });
    }

    const body = subscriptions.get(uuid);

    return body === undefined ? new Response("Not found", { status: 404 }) : Response.json(body);
  };

  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);

    if (url.origin !== REPEAT_ORIGIN || !url.pathname.startsWith(API_PREFIX)) {
      throw new Error(`Unexpected network request in a test: ${request.method} ${request.url}`);
    }

    const path = url.pathname.slice(API_PREFIX.length);

    requests.push(`${request.method} ${path}${url.search}`);

    if (request.headers.get("x-api-key") !== process.env.REPEAT_API_KEY) {
      return new Response("Invalid API key", { status: 401 });
    }

    return respond(path, url);
  };

  vi.stubGlobal("fetch", fakeFetch);

  return {
    /** What `GET /subscriptions/{uuid}/` returns from now on. */
    setSubscription: (body: SubscriptionBody) => {
      subscriptions.set(body.uuid, body);
    },

    /** What `GET /subscriptions/?email=…&active=true` lists. */
    setActiveForEmail: (email: string, rows: readonly ListedSubscription[]) => {
      byEmail.set(email, rows);
    },

    /** Makes one subscription's lookup fail with a 503. */
    failLookup: (uuid: string) => {
      down.add(uuid);
    },

    /** Every call the app made, as `METHOD /path?query`. */
    requests,
  };
};
